import asyncio
import logging
from datetime import datetime
from app.db.session import AsyncSessionLocal
from app.schemas.email import EmailIngest
from app.services.ingestion import ingest_email

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_diagnostics():
    payload = EmailIngest(
        message_id="msg_diag_001",
        sender="bob.jones@enterprise.net",
        subject="Diagnostics Check",
        body="This is a diagnostics check payload.",
        timestamp=datetime.utcnow(),
        thread_id="thread_diag_001"
    )
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting internal diagnostics ingest...")
            email, is_new = await ingest_email(db, payload)
            await db.commit()
            logger.info(f"Ingest Success! ID: {email.id}, Category: {email.category}, Urgency: {email.urgency}")
        except Exception as e:
            logger.exception("Ingest failed inside backend container with traceback:")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
