"""
Populate the Pinecone `features` namespace with GeoGuessr-style text clues.

The backend queries this namespace with an *image* embedding (see
pineconedb.query_pinecone_with_image, called in main.py), relying on CLIP's
shared image/text space: a photo of, say, a French bollard lands near the text
"a slim white bollard with a red reflector ... indicates France". The matched
clue text is then fed to the reasoning LLM (reasoning.py reads metadata['text']).

Source clues live in data/geoguessr_features.json (see backend/REBUILD.md).

Note on thresholds: CLIP image<->text cosine scores are much LOWER than
image<->image scores (typically ~0.2-0.30 for a good match, vs ~0.7+ for similar
images). The feature-query thresholds in main.py/reasoning.py are tuned for this.

Usage:
  docker compose run --rm backend python ingest_features.py
"""
import json
import os

import clip
import torch
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

EMBED_DIM = 512  # CLIP ViT-B/32
NAMESPACE = "features"
HERE = os.path.dirname(os.path.abspath(__file__))

load_dotenv()


def main():
    if not os.getenv("PINECONE_API_KEY"):
        raise SystemExit("PINECONE_API_KEY not set. Put it in backend/.env")

    with open(os.path.join(HERE, "data", "geoguessr_features.json")) as f:
        clues = json.load(f)
    print(f"Loaded {len(clues)} feature clues.")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading CLIP ViT-B/32 on {device} ...")
    model, _ = clip.load("ViT-B/32", device=device)

    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    name = os.getenv("PINECONE_INDEX_NAME", "htv2025")
    if name not in [i["name"] for i in pc.list_indexes()]:
        print(f"Creating index '{name}' (dim={EMBED_DIM}, cosine)...")
        pc.create_index(
            name=name,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    index = pc.Index(name)

    vectors = []
    for i, clue in enumerate(clues):
        tokens = clip.tokenize([clue["text"]], truncate=True).to(device)
        with torch.no_grad():
            vec = model.encode_text(tokens)[0].cpu().tolist()
        vectors.append({
            "id": f"feat-{i}",
            "values": vec,
            "metadata": {
                "text": clue["text"],
                "category": clue.get("category", "other"),
                "region": clue.get("region", "global"),
            },
        })

    index.upsert(vectors=vectors, namespace=NAMESPACE)
    print(f"Upserted {len(vectors)} clues into namespace '{NAMESPACE}'.")
    print("Stats:", index.describe_index_stats())


if __name__ == "__main__":
    main()
