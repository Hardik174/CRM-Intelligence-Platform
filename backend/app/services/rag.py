import os
import logging
import hashlib
import numpy as np
from typing import List, Dict, Any, Tuple
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.config import settings
from app.db.models import KnowledgeChunk

logger = logging.getLogger(__name__)

# Lazy initialization of OpenAI client to avoid failure if key is empty
_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        if settings.OPENAI_API_KEY:
            import openai
            _openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client

def get_embedding(text_to_embed: str) -> List[float]:
    """
    Generate an embedding vector of dimension 1536.
    Uses OpenAI's text-embedding-3-small if an API key is available,
    otherwise falls back to a deterministic mock embedding based on the text hash.
    """
    client = get_openai_client()
    if client:
        try:
            # Clean text input
            clean_text = text_to_embed.replace("\n", " ")
            response = client.embeddings.create(
                input=[clean_text],
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding generation failed: {e}. Falling back to mock embedding.")
            
    # Deterministic Mock Embedding Fallback
    # Hash the text and use it as a seed to generate 1536 dimensions
    hash_obj = hashlib.sha256(text_to_embed.encode("utf-8"))
    seed = int(hash_obj.hexdigest(), 16) % (2**32 - 1)
    
    rng = np.random.default_rng(seed)
    # Generate random vector
    vector = rng.normal(size=1536)
    # Normalize to unit length (so that dot product equals cosine similarity)
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector.tolist()

def chunk_markdown(text_content: str, source_name: str, chunk_size_words: int = 350, overlap_words: int = 50) -> List[str]:
    """
    Splits markdown content into chunks of roughly chunk_size_words (300-500 tokens) with overlap.
    """
    words = text_content.split()
    chunks = []
    
    if len(words) <= chunk_size_words:
        return [text_content]
        
    start = 0
    while start < len(words):
        end = min(start + chunk_size_words, len(words))
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        if end == len(words):
            break
        start += (chunk_size_words - overlap_words)
        
    return chunks

async def seed_knowledge_base_if_empty(db: AsyncSession, force: bool = False):
    """
    Read markdown files from knowledge_base/ directory, chunk them, embed them,
    and seed them into the database if the knowledge_chunks table is currently empty.
    """
    # Check if empty
    if not force:
        stmt = select(KnowledgeChunk).limit(1)
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            logger.info("Knowledge base already seeded. Skipping seeding.")
            return

    kb_dir = "knowledge_base"
    if not os.path.exists(kb_dir):
        logger.warning(f"Knowledge base directory '{kb_dir}' not found. Seeding skipped.")
        return

    logger.info("Seeding knowledge base vector embeddings...")
    for filename in os.listdir(kb_dir):
        if filename.endswith(".md"):
            filepath = os.path.join(kb_dir, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            chunks = chunk_markdown(content, filename)
            logger.info(f"Chunked {filename} into {len(chunks)} segments.")
            
            for chunk_text in chunks:
                emb = get_embedding(chunk_text)
                kc = KnowledgeChunk(
                    source_doc=filename,
                    chunk_text=chunk_text,
                    embedding=emb
                )
                db.add(kc)
    
    await db.commit()
    logger.info("Knowledge base seeding completed.")

async def search_rag(db: AsyncSession, query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Perform a vector similarity search across knowledge chunks using pgvector.
    Returns the top-3 chunks with similarity scores.
    """
    query_embedding = get_embedding(query)
    
    # Calculate cosine similarity: 1 - (embedding <=> query_embedding)
    # We use raw sql or sqlalchemy operators for pgvector search.
    # The pgvector extension defines '<=>' as cosine distance.
    # Cosine similarity is 1 - (embedding <=> query_embedding)
    
    # Using SQLAlchemy text expression for robustness across different pgvector installation environments
    stmt = text("""
        SELECT id, source_doc, chunk_text, 1 - (embedding <=> :query_emb) AS similarity
        FROM knowledge_chunks
        ORDER BY embedding <=> :query_emb
        LIMIT :limit
    """)
    
    result = await db.execute(stmt, {"query_emb": str(query_embedding), "limit": limit})
    rows = result.fetchall()
    
    chunks = []
    for r in rows:
        chunks.append({
            "id": r[0],
            "source_doc": r[1],
            "chunk_text": r[2],
            "similarity": float(r[3] or 0.0)
        })
    return chunks
