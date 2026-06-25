# Rebuilding the Pinecone index

The original `htv2025` Pinecone index was deleted. The geolocation backend needs
it to answer queries. Nothing in the index was original data: it was CLIP
embeddings of a **public Kaggle dataset**, so it can be rebuilt from scratch
with `ingest.py`. No images or text are added by hand.

## What gets rebuilt

- **`images` namespace**: CLIP ViT-B/32 embeddings of ~geotagged images, with
  `{latitude, longitude}` metadata. This is the core of geolocation. Fully
  automatic via `ingest.py`.
- **`features` namespace**: GeoGuessr-style text clues (bollards, road lines,
  plates, scripts, Street View car meta, etc.) read at `reasoning.py` as
  `metadata['text']`. The original list wasn't in git history, so it was rebuilt
  from researched GeoGuessr documentation into `data/geoguessr_features.json` and
  loaded with `ingest_features.py`:
  ```bash
  docker compose run --rm backend python ingest_features.py
  ```
  These are CLIP **text** embeddings queried by an **image** embedding. CLIP
  image-to-text scores are low (~0.19-0.28), so the feature thresholds in main.py
  and reasoning.py (FEATURE_THRESHOLD) are set to ~0.22, not the ~0.7 used for
  image-to-image matches. Add more clues to the JSON and re-run to expand.

## Steps

0. **Create the env file** from the template:
   ```bash
   cp backend/.env.example backend/.env
   ```

1. **Credentials** in `backend/.env`:
   - `PINECONE_API_KEY`: already restored from git history; that account is live,
     and `ingest.py` will create the `htv2025` index in it. (Or use your own
     Pinecone account, the free tier is plenty for ~10k vectors.)
   - `KAGGLE_API_TOKEN`: the only new credential you must supply. This is the
     new-style single-variable token (`KGAT_...`). Get it at kaggle.com,
     Settings, API, Create New Token. The legacy `KAGGLE_USERNAME` /
     `KAGGLE_KEY` pair (from the older `kaggle.json` download) also works as an
     alternative.

2. **Rebuild the backend image** (ingest deps were added to requirements):
   ```bash
   docker compose build backend
   ```

3. **Run the ingestion** (start small to validate the whole path):
   ```bash
   docker compose run --rm backend python ingest.py --limit 2000
   ```
   Then scale up by raising/removing `--limit` (full dataset is slow on CPU).

   **Resumable.** Each completed shard is recorded in
   `backend/uploads/.ingest_checkpoint.json`; re-running skips finished shards
   instead of re-embedding them. So you can chip away across sessions:
   ```bash
   docker compose run --rm backend python ingest.py          # resumes where it left off
   docker compose run --rm backend python ingest.py --reset   # start over from shard 0
   ```
   Notes:
   - `--limit N` counts images ingested *this run*, not total in the index.
   - Goal ~1M: that's about a full day of CPU embedding total, and it may hit
     Pinecone's free-tier ceiling first. The script stops cleanly if so and the
     checkpoint lets you continue later. CPU is the bottleneck (no GPU in Docker).

4. **Start the app**:
   ```bash
   docker compose up -d
   curl localhost:8000/        # backend
   open http://localhost:3000  # frontend
   ```

## Notes

- `ingest.py --help` lists flags: `--limit`, `--shards`, `--namespace`, `--batch-size`.
- The index name is configurable via `PINECONE_INDEX_NAME` (default `htv2025`),
  read by both `ingest.py` and `pineconedb.py`.
- Mapillary street-view images need `MAPILLARY_API_KEY` (not in history); the
  rest of the app works without it.
