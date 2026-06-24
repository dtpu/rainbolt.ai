import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rainbolt")

# Disable the public auto-docs / OpenAPI schema in production (set ENABLE_DOCS=1
# to turn them back on locally). They don't leak secrets, but there's no reason
# to publish the endpoint map on a public deployment.
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "") == "1"

# Origin allowlist. Only requests coming from these origins are accepted, which
# keeps random people / bots who find the public backend URL from calling the
# endpoints and burning the Gemini + Pinecone budget. Set ALLOWED_ORIGINS in the
# host's secrets (comma-separated), e.g.:
#   ALLOWED_ORIGINS=https://rainbolt.vercel.app,https://www.rainbolt.ai
# Falls back to localhost (dev) plus the known production domains.
_DEFAULT_ORIGINS = "http://localhost:3000,http://localhost:3001,https://rainboltai.gay,https://www.rainbolt.ai"
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()
]

# Shared secret for server-to-server calls (the Next.js /api/upload proxy ->
# this backend). The browser never sees this, so it can't be spoofed by reading
# the public frontend. Set BACKEND_INTERNAL_KEY to the same random value in BOTH
# the frontend host (Vercel) and this backend's secrets. If it's left unset, the
# check is skipped (local dev convenience). Set it in production.
INTERNAL_KEY = os.getenv("BACKEND_INTERNAL_KEY", "")

# Index name is configurable so we can point at a freshly-rebuilt index.
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "htv2025")

# Similarity thresholds and result counts used when querying Pinecone.
# Image-to-image cosine scores run high, so IMAGE_MATCH_THRESHOLD is set near 0.7.
# The features namespace holds CLIP *text* embeddings queried with an image
# embedding; those cross-modal scores are much lower (~0.19-0.28 for top matches),
# so FEATURE_MATCH_THRESHOLD is tuned to that range.
IMAGE_MATCH_THRESHOLD = 0.7
FEATURE_MATCH_THRESHOLD = 0.22
MATCH_TOP_K = 25
