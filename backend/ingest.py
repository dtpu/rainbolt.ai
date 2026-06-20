"""
Rebuild the Pinecone `images` namespace from the public Kaggle dataset.

This recreates what the original HTV_scripting.ipynb did: download geotagged-image
shards, embed each image with CLIP ViT-B/32 (512-dim), and upsert the vectors with
{latitude, longitude} metadata into Pinecone. The backend then queries this at
runtime (see pineconedb.query_pinecone_with_image).

Resumable: after each shard is fully embedded+upserted, its index is recorded in a
checkpoint file (in the persistent uploads/ mount). Re-running skips completed
shards instead of re-embedding everything, so an interrupted run picks up where it
left off. Use --reset to ignore the checkpoint and start over.

Prerequisites:
  - PINECONE_API_KEY  : a Pinecone account (free tier is fine)
  - PINECONE_INDEX_NAME (optional, defaults to "htv2025")
  - Kaggle auth for kagglehub: KAGGLE_API_TOKEN (new KGAT_ tokens), or the older
    KAGGLE_USERNAME / KAGGLE_KEY pair / ~/.kaggle/kaggle.json.

Usage (from repo root, inside the backend image so deps are present):
  docker compose run --rm backend python ingest.py --limit 2000   # quick validation
  docker compose run --rm backend python ingest.py                # full dataset (resumes)

Flags:
  --limit N       max images to ingest this run (default: all)
  --shards N      max shards to try; stops early when the dataset runs out
  --namespace S   target namespace (default: "images" - what the backend queries)
  --batch-size N  vectors per Pinecone upsert
  --embed-batch N images per CLIP forward pass
  --reset         ignore the checkpoint and re-ingest from shard 0
"""
import argparse
import io
import json
import os
import sys
import time

import clip
import msgpack
import torch
from dotenv import load_dotenv
from PIL import Image
from pinecone import Pinecone, ServerlessSpec

DATASET = "habedi/large-dataset-of-geotagged-images"
EMBED_DIM = 512  # CLIP ViT-B/32
HERE = os.path.dirname(os.path.abspath(__file__))
# Stored in the persistent uploads/ bind-mount so it survives `docker run --rm`.
CHECKPOINT = os.path.join(HERE, "uploads", ".ingest_checkpoint.json")

load_dotenv()


def load_checkpoint():
    try:
        with open(CHECKPOINT) as f:
            return set(json.load(f).get("completed_shards", []))
    except (FileNotFoundError, ValueError):
        return set()


def save_checkpoint(completed):
    os.makedirs(os.path.dirname(CHECKPOINT), exist_ok=True)
    with open(CHECKPOINT, "w") as f:
        json.dump({"completed_shards": sorted(completed)}, f)


def get_image(record):
    return Image.open(io.BytesIO(record["image"])).convert("RGB")


def ensure_index(pc, name):
    existing = [i["name"] for i in pc.list_indexes()]
    if name not in existing:
        print(f"Creating index '{name}' (dim={EMBED_DIM}, cosine)...")
        pc.create_index(
            name=name,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    else:
        print(f"Index '{name}' already exists - upserting into it.")
    return pc.Index(name)


def iter_records(shards, completed):
    """Download shards via kagglehub and yield (shard_index, record).

    Skips shards already in `completed`, and stops cleanly when a shard no longer
    exists (so --shards can be set high and the run just consumes what's there)."""
    import kagglehub

    for s in range(shards):
        if s in completed:
            print(f"shard_{s}.msg already done - skipping")
            continue
        name = f"shard_{s}.msg"
        print(f"Downloading {name} ...")
        # Only a "not found" means the dataset is exhausted; anything else
        # (IncompleteRead, connection reset, timeout) is transient - retry.
        path = None
        for attempt in range(6):
            try:
                path = kagglehub.dataset_download(DATASET, path=f"shards/{name}")
                break
            except Exception as e:
                msg = str(e).lower()
                if "404" in msg or "not found" in msg:
                    print(f"No more shards (stopped at {name}): {e}")
                    return
                wait = min(120, 10 * 2 ** attempt)
                print(f"download error for {name} (attempt {attempt + 1}/6): {e} - retrying in {wait}s", flush=True)
                time.sleep(wait)
        if path is None:
            print(f"Giving up on {name} after repeated download failures - stopping.", flush=True)
            return
        with open(path, "rb") as f:
            for record in msgpack.Unpacker(f, raw=False):
                yield s, record


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--shards", type=int, default=50, help="max shards to try; stops early when the dataset runs out")
    ap.add_argument("--namespace", default="images")
    ap.add_argument("--batch-size", type=int, default=200, help="vectors per Pinecone upsert")
    ap.add_argument("--embed-batch", type=int, default=64, help="images per CLIP forward pass")
    ap.add_argument("--reset", action="store_true", help="ignore checkpoint and re-ingest from shard 0")
    args = ap.parse_args()

    if not os.getenv("PINECONE_API_KEY"):
        sys.exit("PINECONE_API_KEY not set. Put it in backend/.env")

    index_name = os.getenv("PINECONE_INDEX_NAME", "htv2025")
    completed = set() if args.reset else load_checkpoint()
    if completed:
        print(f"Resuming - already-completed shards: {sorted(completed)}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading CLIP ViT-B/32 on {device} ...")
    model, preprocess = clip.load("ViT-B/32", device=device)

    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = ensure_index(pc, index_name)

    pending = []      # (rid, lat, lon, preprocessed_tensor) awaiting a CLIP pass
    upsert_batch = []
    total = 0
    stopped = False

    # Quota/billing errors mean "stop, the free tier is full" - not worth retrying.
    # Everything else (DNS, connection reset, timeout, 429/500/503) is transient and
    # gets retried with exponential backoff so a network blip can't kill a long run.
    NON_RETRYABLE = ("quota", "exceed", "storage", "402", "payment", "forbidden")

    def safe_upsert(retries=6):
        """Upsert with retries on transient errors. Returns False to stop the run."""
        for attempt in range(retries):
            try:
                index.upsert(vectors=upsert_batch, namespace=args.namespace)
                print(f"upserted {total} images", flush=True)
                upsert_batch.clear()
                return True
            except Exception as e:
                msg = str(e).lower()
                if any(k in msg for k in NON_RETRYABLE):
                    print(f"\nPinecone limit reached at ~{total} vectors - stopping cleanly. ({e})", flush=True)
                    return False
                wait = min(60, 2 ** attempt)
                print(f"upsert error (attempt {attempt + 1}/{retries}): {e} - retrying in {wait}s", flush=True)
                time.sleep(wait)
        print(f"\nGave up after {retries} failed upsert attempts at ~{total} vectors - stopping.", flush=True)
        return False

    def embed_pending():
        nonlocal pending, total
        if not pending:
            return
        tensors = torch.stack([t for *_, t in pending]).to(device)
        with torch.no_grad():
            vecs = model.encode_image(tensors).cpu().tolist()
        for (rid, lat, lon, _), v in zip(pending, vecs):
            upsert_batch.append({
                "id": rid,
                "values": v,
                "metadata": {"latitude": float(lat), "longitude": float(lon)},
            })
        total += len(pending)
        pending = []

    def finish_shard(shard_idx):
        """Flush everything buffered and mark the shard complete. Returns False on quota stop."""
        embed_pending()
        if upsert_batch and not safe_upsert():
            return False
        completed.add(shard_idx)
        save_checkpoint(completed)
        print(f"shard_{shard_idx}.msg complete ({total} images so far)", flush=True)
        return True

    current = None
    for shard_idx, record in iter_records(args.shards, completed):
        if current is None:
            current = shard_idx
        elif shard_idx != current:
            if not finish_shard(current):   # previous shard fully consumed
                stopped = True
                break
            current = shard_idx

        if args.limit is not None and total + len(pending) >= args.limit:
            stopped = True
            break

        try:
            img = get_image(record)
            tensor = preprocess(img)
            lat, lon = record["latitude"], record["longitude"]
            rid = str(record.get("id", f"{shard_idx}-{total + len(pending)}"))
        except (KeyError, OSError):
            continue  # skip malformed records

        pending.append((rid, lat, lon, tensor))
        if len(pending) >= args.embed_batch:
            embed_pending()
        if len(upsert_batch) >= args.batch_size:
            if not safe_upsert():
                stopped = True
                break

    # If we exhausted the dataset (not stopped by limit/quota), the final shard is done.
    if not stopped and current is not None:
        finish_shard(current)

    print(f"\nDone. Ingested {total} images this run into '{index_name}' namespace '{args.namespace}'.")
    try:
        print("Stats:", index.describe_index_stats())
    except Exception as e:
        print(f"(could not fetch final stats: {e})")


if __name__ == "__main__":
    main()
