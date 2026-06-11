import asyncio
import logging
from app.db.session import AsyncSessionLocal
from app.services.rag import seed_knowledge_base_if_empty

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting knowledge base seeding via CLI...")
    async with AsyncSessionLocal() as db:
        try:
            await seed_knowledge_base_if_empty(db, force=True)
            logger.info("CLI Seeding succeeded.")
        except Exception as e:
            logger.error(f"CLI Seeding failed: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(main())
