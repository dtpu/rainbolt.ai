import os
from typing import List

import clip
import torch
from dotenv import load_dotenv
from PIL import Image
from pinecone import Pinecone

load_dotenv()


device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

# Index name is configurable so we can point at a freshly-rebuilt index.
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "htv2025")

_index = None


def get_index():
    """
    Lazily create the Pinecone client/index on first use. Doing this lazily (vs.
    at import time) lets the backend boot, and serve health checks, even when
    PINECONE_API_KEY is missing or the index doesn't exist yet.
    """
    global _index
    if _index is None:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise RuntimeError("PINECONE_API_KEY environment variable not set")
        _index = Pinecone(api_key=api_key).Index(INDEX_NAME)
    return _index


def query_pinecone(vector, top_k=5, namespace=None, threshold=0) -> List[dict]:
    """Query the index with a vector, optionally dropping matches below threshold."""
    response = get_index().query(vector=vector, top_k=top_k, include_metadata=True, namespace=namespace)
    matches = response['matches']
    if threshold > 0:
        matches = [m for m in matches if m['score'] >= threshold]
    return matches


def query_pinecone_with_image(image: Image.Image, top_k=5, namespace=None, threshold=0) -> List[dict]:
    """Embed an image with CLIP, then query the index with that vector."""
    image_input = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        vector = model.encode_image(image_input).tolist()
    return query_pinecone(vector, top_k=top_k, namespace=namespace, threshold=threshold)


def query_pinecone_with_text(text: str, top_k=5, namespace=None) -> List[dict]:
    """Embed text with CLIP, then query the index with that vector."""
    text_input = clip.tokenize([text]).to(device)
    with torch.no_grad():
        vector = model.encode_text(text_input).tolist()
    return query_pinecone(vector, top_k=top_k, namespace=namespace)

