import os
import logging
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
CACHE_DIR = os.getenv("HF_HOME", "./.model-cache")

model: SentenceTransformer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading {MODEL_NAME} on {device} (CUDA: {torch.cuda.is_available()})")
    model = SentenceTransformer(MODEL_NAME, device=device, cache_folder=CACHE_DIR)
    logger.info("Embedding model ready")
    yield
    model = None


app = FastAPI(lifespan=lifespan)


class EmbedRequest(BaseModel):
    text: str


class EmbedBatchRequest(BaseModel):
    texts: list[str]


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "device": str(next(model.parameters()).device) if model else "not loaded"}


@app.post("/embed")
def embed(req: EmbedRequest):
    assert model is not None
    vector = model.encode(req.text, normalize_embeddings=True).tolist()
    return {"embedding": vector}


@app.post("/embed/batch")
def embed_batch(req: EmbedBatchRequest):
    assert model is not None
    vectors = model.encode(req.texts, normalize_embeddings=True).tolist()
    return {"embeddings": vectors}
