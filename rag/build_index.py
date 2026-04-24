import os
import json
import logging
from pathlib import Path
import asyncio
import numpy as np

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

_RAG_DIR = Path(__file__).parent
INDEX_DIR = _RAG_DIR / "index"
KNOWLEDGE_FILE = _RAG_DIR / "knowledge_base.json"
EMBEDDINGS_FILE = INDEX_DIR / "embeddings.npy"
METADATA_FILE = INDEX_DIR / "metadata.json"

async def build_index():
    if not KNOWLEDGE_FILE.exists():
        logger.error(f"Knowledge base file not found: {KNOWLEDGE_FILE}")
        return

    with open(KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
        knowledge_items = json.load(f)

    logger.info(f"Loaded {len(knowledge_items)} knowledge items.")

    # We need to import the retriever to use its embedding logic
    from retriever import KnowledgeRetriever
    
    retriever = KnowledgeRetriever()
    # Mocking _load_index so it doesn't fail if index doesn't exist
    retriever._ready = True 
    
    if not retriever._api_key:
        from dotenv import load_dotenv
        load_dotenv()
        retriever._api_key = os.getenv("LLM_API_KEY", "")
        if not retriever._api_key:
             logger.error("LLM_API_KEY not found in environment. Please check your .env file.")
             return
            
    embeddings = []
    metadata = []

    for item in knowledge_items:
        text_to_embed = f"【{item.get('category', '')}】{item.get('title', '')}\n{item.get('content', '')}"
        logger.info(f"Embedding: {item.get('title', '')}")
        
        vec = await retriever.embed(text_to_embed)
        if vec is not None:
            embeddings.append(vec)
            metadata.append(item)
        else:
            logger.error(f"Failed to embed item: {item.get('title', '')}")

    if not embeddings:
        logger.error("No embeddings generated. Index build failed.")
        return

    embeddings_np = np.array(embeddings, dtype=np.float32)
    
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    
    np.save(str(EMBEDDINGS_FILE), embeddings_np)
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    logger.info(f"Index built successfully! Saved {len(metadata)} items to {INDEX_DIR}")

if __name__ == "__main__":
    asyncio.run(build_index())
