import os
import logging
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
RERANKER_MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
CACHE_DIR = os.getenv("HF_HOME", "./.model-cache")

model: SentenceTransformer | None = None
reranker: CrossEncoder | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, reranker
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading {MODEL_NAME} on {device} (CUDA: {torch.cuda.is_available()})")
    model = SentenceTransformer(MODEL_NAME, device=device, cache_folder=CACHE_DIR)
    logger.info("Embedding model ready")
    logger.info(f"Loading {RERANKER_MODEL_NAME} on {device}")
    reranker = CrossEncoder(RERANKER_MODEL_NAME, device=device, cache_dir=CACHE_DIR, max_length=512)
    logger.info("Reranker model ready")
    yield
    model = None
    reranker = None


app = FastAPI(lifespan=lifespan)


class EmbedRequest(BaseModel):
    text: str


class EmbedBatchRequest(BaseModel):
    texts: list[str]


class RerankRequest(BaseModel):
    query: str
    passages: list[str]


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


@app.post("/rerank")
def rerank(req: RerankRequest):
    assert reranker is not None
    pairs = [(req.query, p) for p in req.passages]
    scores: list[float] = reranker.predict(pairs).tolist()
    return {"scores": scores}
