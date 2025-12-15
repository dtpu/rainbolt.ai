from typing import List
from pinecone import Pinecone
import os
import clip
import torch
from PIL import Image
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file


device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-B/32", device=device)

# env variables should be loaded in upstream code
if not os.getenv("PINECONE_API_KEY"):
    raise ValueError("PINECONE_API_KEY environment variable not set")

pinecone = Pinecone(
    api_key=os.getenv("PINECONE_API_KEY"),
)

# Get index name from environment variable or use default
index_name = os.getenv("PINECONE_INDEX_NAME", "htv2025")
index = pinecone.Index(index_name)

def query_pinecone(vector, top_k=5, namespace=None, threshold=0) -> List[dict]:
    """
    Query Pinecone index with a vector and return top_k results
    """
    response = index.query(vector=vector, top_k=top_k, include_metadata=True, namespace=namespace)
    matches = response['matches']
    if threshold > 0:
        matches = [m for m in matches if m['score'] >= threshold]
    return matches

def query_pinecone_with_image(image: Image.Image, top_k=5, namespace=None, threshold=0) -> List[dict]:
    """
    Embed image and query Pinecone index
    """
    image_input = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        vector = model.encode_image(image_input).tolist()
    return query_pinecone(vector, top_k=top_k, namespace=namespace, threshold=threshold)

def query_pinecone_with_text(text: str, top_k=5, namespace=None) -> List[dict]:
    """
    Embed text and query Pinecone index
    """
    text_input = clip.tokenize([text]).to(device)
    with torch.no_grad():
        vector = model.encode_text(text_input).tolist()
    return query_pinecone(vector, top_k=top_k, namespace=namespace)

