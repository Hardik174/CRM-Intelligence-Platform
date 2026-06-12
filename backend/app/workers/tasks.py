import os
import asyncio
import logging
from celery import Celery
from app.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.services.agent_workflow import run_agent_loop

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "crm_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Async helper to process the email using the db session
async def async_process_email(email_id: int):
    try:
        async with AsyncSessionLocal() as db:
            try:
                logger.info(f"Background worker starting triage for Email ID: {email_id}")
                result = await run_agent_loop(db, email_id, dry_run=False)
                await db.commit()
                logger.info(f"Triage completed for Email ID {email_id}: {result}")
                
                # Trigger Redis Pub/Sub event for WebSockets
                try:
                    import json
                    from redis.asyncio import Redis
                    redis_client = Redis.from_url(settings.REDIS_URL)
                    await redis_client.publish(
                        "crm_events",
                        json.dumps({
                            "event": "ACTION_COMPLETED",
                            "thread_id": result.get("thread_id") or "",
                            "sender_email": result.get("sender_email") or ""
                        })
                    )
                    await redis_client.close()
                except Exception as pub_err:
                    logger.error(f"Failed to publish crm_events on task completion: {pub_err}")
                    
                return result
            except Exception as e:
                logger.error(f"Error in async email worker: {e}", exc_info=True)
                await db.rollback()
                # Update email status to Error if possible
                try:
                    from sqlalchemy.future import select
                    from app.db.models import Email
                    stmt = select(Email).where(Email.id == email_id)
                    res = await db.execute(stmt)
                    email = res.scalar_one_or_none()
                    if email:
                        email.status = "Error"
                        db.add(email)
                        await db.commit()
                except Exception as db_err:
                    logger.error(f"Failed to set email status to Error: {db_err}")
                raise e
    finally:
        await engine.dispose()

@celery_app.task(name="app.workers.tasks.process_email_task", bind=True, max_retries=3)
def process_email_task(self, email_id: int):
    """
    Celery background task. Uses asyncio.run to execute the async agent pipeline.
    """
    try:
        # Run the async loop inside the sync worker process
        return asyncio.run(async_process_email(email_id))
    except Exception as exc:
        logger.error(f"Task process_email_task failed for email_id {email_id}. Retrying... Error: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=5 * self.request.retries)
