import logging
from sqlalchemy import text
from app.db.session import SessionLocal, Base
from app.db.models import Contact, Thread, Email, Action, KnowledgeChunk, WebIntelligenceCache, AuditLog

logger = logging.getLogger(__name__)

def init_db():
    db = SessionLocal()
    try:
        logger.info("Initializing database and extensions...")
        # Enable pgvector extension
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        db.commit()
        
        # Create all tables
        Base.metadata.create_all(bind=db.get_bind())
        db.commit()
        
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
