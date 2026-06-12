from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, update, delete
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from app.db.session import get_db
from app.db.models import Email, Thread, Contact, Action, AuditLog, WebIntelligenceCache
from app.schemas.email import EmailIngest, IngestResponse, JobStatusResponse, EmailDetail
from app.schemas.thread import ThreadResponse, ThreadSummary
from app.schemas.contact import ContactResponse
from app.schemas.agent import AgentDryRunResponse, DraftEdit, ActionDetail

from app.services.ingestion import ingest_email
from app.services.agent_workflow import run_agent_loop, create_audit_entry
from app.services.rag import search_rag
from app.services.scraper import get_scraped_sentiment
from app.workers.tasks import process_email_task, celery_app

router = APIRouter()

# 1. POST /api/ingest
@router.post("/api/ingest", response_model=IngestResponse, status_code=201)
async def post_ingest_email(payload: EmailIngest, db: AsyncSession = Depends(get_db)):
    try:
        email, is_new = await ingest_email(db, payload)
        await db.commit()
        
        if is_new:
            # Dispatch background worker task
            task = process_email_task.delay(email.id)
            job_id = task.id
            job_status = "Processing"
        else:
            job_id = f"dup_{email.message_id}"
            job_status = "Completed"
            
        return IngestResponse(
            job_id=job_id,
            status=job_status,
            message_id=email.message_id,
            thread_id=email.thread_id
        )
    except Exception as e:
        await db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "INGESTION_ERROR", "message": "Failed to ingest email", "details": str(e)}
        )

# 2. GET /api/status/{job_id}
@router.get("/api/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    if job_id.startswith("dup_"):
        # Duplicate shortcut
        msg_id = job_id.replace("dup_", "")
        stmt = select(Email).where(Email.message_id == msg_id)
        res = await db.execute(stmt)
        email = res.scalar_one_or_none()
        return JobStatusResponse(
            job_id=job_id,
            status="SUCCESS",
            email_id=email.id if email else None
        )

    # Fetch from Celery
    res_task = celery_app.AsyncResult(job_id)
    task_status = res_task.status
    
    status_mapping = {
        "PENDING": "Processing",
        "STARTED": "Processing",
        "RETRY": "Processing",
        "SUCCESS": "SUCCESS",
        "FAILURE": "FAILURE"
    }
    
    err_msg = None
    email_id = None
    
    if task_status == "SUCCESS":
        result_val = res_task.result
        email_id = result_val.get("email_id") if isinstance(result_val, dict) else None
    elif task_status == "FAILURE":
        err_msg = str(res_task.result)
        
    return JobStatusResponse(
        job_id=job_id,
        status=status_mapping.get(task_status, "Processing"),
        email_id=email_id,
        error=err_msg
    )

# 3. GET /dashboard/stats
@router.get("/dashboard/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Counts: Pending (status=Received/Processing), Replied (actions.action_type=Auto-Reply & is_approved=True),
    # Escalated (status=Escalated), Critical (urgency=Critical), Spam filtered (category=Spam)
    try:
        stmt_pending = select(func.count(Email.id)).where(Email.status.in_(["Received", "Processing"]))
        res_pending = await db.execute(stmt_pending)
        pending_count = res_pending.scalar() or 0

        stmt_escalated = select(func.count(Email.id)).where(Email.status == "Escalated")
        res_escalated = await db.execute(stmt_escalated)
        escalated_count = res_escalated.scalar() or 0

        stmt_critical = select(func.count(Email.id)).where(Email.urgency == "Critical")
        res_critical = await db.execute(stmt_critical)
        critical_count = res_critical.scalar() or 0

        stmt_spam = select(func.count(Email.id)).where(Email.category == "Spam")
        res_spam = await db.execute(stmt_spam)
        spam_count = res_spam.scalar() or 0

        # Replied (emails with executed auto replies or human responses)
        stmt_replied = select(func.count(Email.id)).where(Email.status == "Replied")
        res_replied = await db.execute(stmt_replied)
        replied_count = res_replied.scalar() or 0

        return {
            "pending": pending_count,
            "replied": replied_count,
            "escalated": escalated_count,
            "critical": critical_count,
            "spam_filtered": spam_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "STATS_FETCH_ERROR", "message": "Failed to fetch stats", "details": str(e)}
        )

# 4. GET /threads/{contact_email}
@router.get("/threads/{contact_email}", response_model=List[ThreadResponse])
async def get_contact_threads(contact_email: str, db: AsyncSession = Depends(get_db)):
    try:
        # Performance requirement: return full thread under 100ms
        stmt = select(Thread).where(Thread.sender_email == contact_email).order_by(Thread.last_updated_at.desc())
        res = await db.execute(stmt)
        threads = res.scalars().all()
        
        results = []
        for t in threads:
            stmt_e = select(Email).where(Email.thread_id == t.thread_id).order_by(Email.timestamp)
            res_e = await db.execute(stmt_e)
            emails = res_e.scalars().all()
            
            results.append(ThreadResponse(
                id=t.id,
                thread_id=t.thread_id,
                subject=t.subject,
                sender_email=t.sender_email,
                first_seen_at=t.first_seen_at,
                last_updated_at=t.last_updated_at,
                status=t.status,
                assigned_to=t.assigned_to,
                summary=t.summary,
                emails=[EmailDetail.from_orm(e) for e in emails]
            ))
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "THREADS_FETCH_ERROR", "message": "Failed to fetch thread", "details": str(e)}
        )

# Extra utility to list all threads for dashboard inbox view
@router.get("/threads", response_model=List[ThreadSummary])
async def list_all_threads(
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None, description="Open, Resolved, Escalated, Ignored"),
    category: Optional[str] = Query(None)
):
    try:
        stmt = select(Thread).order_by(Thread.last_updated_at.desc())
        if status:
            stmt = stmt.where(Thread.status == status)
        res = await db.execute(stmt)
        threads = res.scalars().all()
        
        summaries = []
        for t in threads:
            # Get email count and average sentiment
            stmt_metrics = select(
                func.count(Email.id),
                func.avg(Email.sentiment_score),
                func.max(Email.body)  # dummy to select last body
            ).where(Email.thread_id == t.thread_id)
            res_metrics = await db.execute(stmt_metrics)
            metrics = res_metrics.first()
            
            # Fetch last email body
            stmt_last = select(Email.body).where(Email.thread_id == t.thread_id).order_by(Email.timestamp.desc()).limit(1)
            res_last = await db.execute(stmt_last)
            last_body = res_last.scalar() or ""
            
            if category:
                # Check if thread contains any email of this category
                stmt_cat = select(func.count(Email.id)).where(Email.thread_id == t.thread_id, Email.category == category)
                res_cat = await db.execute(stmt_cat)
                if (res_cat.scalar() or 0) == 0:
                    continue

            summaries.append(ThreadSummary(
                id=t.id,
                thread_id=t.thread_id,
                subject=t.subject,
                sender_email=t.sender_email,
                first_seen_at=t.first_seen_at,
                last_updated_at=t.last_updated_at,
                status=t.status,
                assigned_to=t.assigned_to,
                last_email_body=last_body[:120],
                email_count=metrics[0] or 0,
                sentiment_average=float(metrics[1] or 0.0)
            ))
        return summaries
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "THREADS_LIST_ERROR", "message": "Failed to list threads", "details": str(e)}
        )

# 5. POST /respond/{email_id}
@router.post("/respond/{email_id}")
async def post_respond_email(
    email_id: int,
    payload: Dict[str, str],
    db: AsyncSession = Depends(get_db)
):
    try:
        reply_body = payload.get("body")
        if not reply_body:
            raise HTTPException(status_code=400, detail="Response body is required.")
            
        stmt = select(Email).where(Email.id == email_id)
        res = await db.execute(stmt)
        orig_email = res.scalar_one_or_none()
        
        if not orig_email:
            raise HTTPException(status_code=404, detail="Original email not found")
            
        # Create a replied email entry
        new_msg_id = f"reply_{orig_email.message_id}_{int(datetime.utcnow().timestamp())}"
        reply_email = Email(
            thread_id=orig_email.thread_id,
            message_id=new_msg_id,
            sender="support@mycompany.com",
            subject=f"Re: {orig_email.subject}",
            body=reply_body,
            timestamp=datetime.utcnow(),
            sentiment_score=0.2,
            category="Internal",
            urgency=orig_email.urgency,
            requires_human=False,
            confidence=1.0,
            raw_entities={},
            status="Replied"
        )
        db.add(reply_email)
        
        # Update thread state and original email state
        orig_email.status = "Replied"
        db.add(orig_email)
        
        stmt_t = select(Thread).where(Thread.thread_id == orig_email.thread_id)
        res_t = await db.execute(stmt_t)
        thread = res_t.scalar_one_or_none()
        if thread:
            thread.status = "Resolved"
            thread.last_updated_at = datetime.utcnow()
            db.add(thread)
            
        # Log action
        act = Action(
            email_id=email_id,
            agent_reasoning_log=[{"thought": "Human response sent", "action": "send_reply", "observation": "replied"}],
            action_type="Auto-Reply",
            proposed_content=reply_body,
            is_approved=True,
            executed_at=datetime.utcnow()
        )
        db.add(act)
        
        await create_audit_entry(
            db, "emails", orig_email.message_id, "SEND_RESPONSE", "user", {"reply_message_id": new_msg_id}
        )
        await db.commit()
        
        # Trigger WebSocket update
        try:
            from redis.asyncio import Redis
            from app.config import settings
            import json
            redis_client = Redis.from_url(settings.REDIS_URL)
            await redis_client.publish(
                "crm_events",
                json.dumps({
                    "event": "THREAD_UPDATED",
                    "thread_id": orig_email.thread_id,
                    "sender_email": orig_email.sender
                })
            )
            await redis_client.close()
        except Exception as pub_err:
            pass
            
        return {"status": "success", "message_id": new_msg_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "RESPONSE_ERROR", "message": "Failed to send response", "details": str(e)}
        )

# 6. PATCH /drafts/{id}
@router.patch("/drafts/{action_id}")
async def patch_draft(
    action_id: int,
    payload: DraftEdit,
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(Action).where(Action.id == action_id)
        res = await db.execute(stmt)
        action = res.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="Draft action not found")
            
        old_content = action.proposed_content
        action.proposed_content = payload.proposed_content
        db.add(action)
        
        await create_audit_entry(
            db,
            "actions",
            str(action.id),
            "EDIT_DRAFT",
            "user",
            {"old_content": old_content, "new_content": payload.proposed_content}
        )
        await db.commit()
        
        # Trigger WebSocket update
        try:
            from redis.asyncio import Redis
            from app.config import settings
            import json
            redis_client = Redis.from_url(settings.REDIS_URL)
            stmt_e = select(Email).where(Email.id == action.email_id)
            res_e = await db.execute(stmt_e)
            email_rec = res_e.scalar_one_or_none()
            if email_rec:
                await redis_client.publish(
                    "crm_events",
                    json.dumps({
                        "event": "THREAD_UPDATED",
                        "thread_id": email_rec.thread_id,
                        "sender_email": email_rec.sender
                    })
                )
            await redis_client.close()
        except Exception:
            pass
            
        return {"status": "success", "draft_id": action.id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "DRAFT_EDIT_ERROR", "message": "Failed to update draft", "details": str(e)}
        )

# 7. POST /drafts/{id}/approve
@router.post("/drafts/{action_id}/approve")
async def approve_draft(
    action_id: int,
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(Action).where(Action.id == action_id)
        res = await db.execute(stmt)
        action = res.scalar_one_or_none()
        
        if not action:
            raise HTTPException(status_code=404, detail="Draft action not found")
            
        stmt_e = select(Email).where(Email.id == action.email_id)
        res_e = await db.execute(stmt_e)
        email = res_e.scalar_one_or_none()
        
        # Approve and mark executed
        action.is_approved = True
        action.approved_by = "user_admin"
        action.executed_at = datetime.utcnow()
        db.add(action)
        
        if email:
            email.status = "Replied"
            db.add(email)
            
            # Update thread status
            stmt_t = select(Thread).where(Thread.thread_id == email.thread_id)
            res_t = await db.execute(stmt_t)
            thread = res_t.scalar_one_or_none()
            if thread:
                thread.status = "Resolved"
                db.add(thread)
                
            # Create a replies email block representing the outgoing mail
            new_msg_id = f"auto_reply_{email.message_id}_{int(datetime.utcnow().timestamp())}"
            reply_email = Email(
                thread_id=email.thread_id,
                message_id=new_msg_id,
                sender="support@mycompany.com",
                subject=f"Re: {email.subject}",
                body=action.proposed_content,
                timestamp=datetime.utcnow(),
                sentiment_score=0.2,
                category="Internal",
                urgency=email.urgency,
                requires_human=False,
                confidence=1.0,
                raw_entities={},
                status="Replied"
            )
            db.add(reply_email)
            
        await create_audit_entry(
            db,
            "actions",
            str(action_id),
            "APPROVE_DRAFT",
            "user_admin",
            {"executed_at": action.executed_at.isoformat()}
        )
        await db.commit()
        
        # Trigger WebSocket update
        try:
            from redis.asyncio import Redis
            from app.config import settings
            import json
            redis_client = Redis.from_url(settings.REDIS_URL)
            if email:
                await redis_client.publish(
                    "crm_events",
                    json.dumps({
                        "event": "THREAD_UPDATED",
                        "thread_id": email.thread_id,
                        "sender_email": email.sender
                    })
                )
            await redis_client.close()
        except Exception:
            pass
            
        return {"status": "success", "executed_at": action.executed_at}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "DRAFT_APPROVE_ERROR", "message": "Failed to approve draft", "details": str(e)}
        )

# 8. GET /analytics/sentiment-trend
@router.get("/analytics/sentiment-trend")
async def get_sentiment_trend(
    sender: Optional[str] = Query(None),
    days: int = Query(30),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Performance index requirement: Index was added in models.py
        target_date = datetime.utcnow() - timedelta(days=days)
        stmt = select(
            func.date_trunc("day", Email.timestamp).label("day"),
            func.avg(Email.sentiment_score).label("avg_sentiment")
        ).where(Email.timestamp >= target_date)
        
        if sender:
            stmt = stmt.where(Email.sender == sender)
            
        stmt = stmt.group_by(text("day")).order_by(text("day"))
        res = await db.execute(stmt)
        rows = res.fetchall()
        
        data = []
        for r in rows:
            data.append({
                "date": r[0].date().isoformat() if r[0] else "",
                "sentiment_score": float(r[1] or 0.0)
            })
            
        return {"trend": data}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "ANALYTICS_ERROR", "message": "Failed to get sentiment trend", "details": str(e)}
        )

# 9. GET /analytics/category-breakdown
@router.get("/analytics/category-breakdown")
async def get_category_breakdown(
    days: int = Query(30),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_date = datetime.utcnow() - timedelta(days=days)
        stmt = select(
            Email.category,
            func.count(Email.id)
        ).where(Email.timestamp >= target_date).group_by(Email.category)
        
        res = await db.execute(stmt)
        rows = res.fetchall()
        
        data = {}
        for r in rows:
            cat = r[0] or "Unclassified"
            data[cat] = r[1]
            
        return {"breakdown": data}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "ANALYTICS_ERROR", "message": "Failed to get category breakdown", "details": str(e)}
        )

# 10. GET /rag/search
@router.get("/rag/search")
async def get_rag_search(
    q: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Performance requirement: retrieval under 200ms
        chunks = await search_rag(db, q, limit=3)
        return {"query": q, "results": chunks}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "RAG_SEARCH_ERROR", "message": "Failed to search knowledge base", "details": str(e)}
        )

# 11. GET /intelligence/reputation
@router.get("/intelligence/reputation")
async def get_reputation(
    company: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        data = await get_scraped_sentiment(db, company)
        return {"company": company, "intelligence": data}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "REPUTATION_ERROR", "message": "Failed to fetch reputation data", "details": str(e)}
        )

# 12. POST /agent/dry-run/{email_id}
@router.post("/agent/dry-run/{email_id}", response_model=AgentDryRunResponse)
async def post_agent_dry_run(
    email_id: int,
    db: AsyncSession = Depends(get_db)
):
    try:
        # Runs agent loop with dry_run=True (no database writes)
        result = await run_agent_loop(db, email_id, dry_run=True)
        return AgentDryRunResponse(
            email_id=result["email_id"],
            thread_id=result["thread_id"],
            heuristics_flagged=result["heuristics_flagged"],
            sentiment_score=result["sentiment_score"],
            category=result["category"],
            urgency=result["urgency"],
            requires_human=result["requires_human"],
            reasoning_trace=result["reasoning_trace"],
            proposed_action=result["proposed_action"],
            suggested_reply=result["suggested_reply"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "DRY_RUN_ERROR", "message": "Failed to run agent dry-run", "details": str(e)}
        )

# 13. GET /audit/{entity_type}/{entity_id}
@router.get("/audit/{entity_type}/{entity_id}", response_model=List[Dict[str, Any]])
async def get_audit_trail(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(AuditLog).where(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        ).order_by(AuditLog.timestamp.desc())
        
        res = await db.execute(stmt)
        logs = res.scalars().all()
        
        return [
            {
                "id": l.id,
                "entity_type": l.entity_type,
                "entity_id": l.entity_id,
                "action": l.action,
                "performed_by": l.performed_by,
                "timestamp": l.timestamp.isoformat(),
                "diff": l.diff
            } for l in logs
        ]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "AUDIT_FETCH_ERROR", "message": "Failed to fetch audit trails", "details": str(e)}
        )

# 14. GET /contacts/{email}
@router.get("/contacts/{email}", response_model=ContactResponse)
async def get_contact_by_email(email: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Contact).where(Contact.email == email)
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    return contact

# 15. PATCH /contacts/{email}/status
@router.patch("/contacts/{email}/status", response_model=ContactResponse)
async def patch_contact_status(
    email: str,
    payload: Dict[str, str],
    db: AsyncSession = Depends(get_db)
):
    try:
        new_status = payload.get("status")
        if not new_status or new_status not in ["VIP", "Blocked", "Active", "Churned"]:
            raise HTTPException(status_code=400, detail="Invalid status. Must be VIP, Blocked, Active, or Churned.")
            
        stmt = select(Contact).where(Contact.email == email)
        res = await db.execute(stmt)
        contact = res.scalar_one_or_none()
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
            
        old_status = contact.status
        contact.status = new_status
        db.add(contact)
        
        await create_audit_entry(
            db,
            "contacts",
            email,
            "UPDATE_STATUS",
            "user",
            {"old_status": old_status, "new_status": new_status}
        )
        
        await db.commit()
        return contact
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "CONTACT_UPDATE_ERROR", "message": "Failed to update contact status", "details": str(e)}
        )

# Extra utility to list all contacts
@router.get("/contacts", response_model=List[ContactResponse])
async def list_all_contacts(db: AsyncSession = Depends(get_db)):
    stmt = select(Contact).order_by(Contact.name)
    res = await db.execute(stmt)
    return res.scalars().all()

# Extra utility to get Actions for an email
@router.get("/actions/{email_id}", response_model=List[ActionDetail])
async def get_email_actions(email_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Action).where(Action.email_id == email_id).order_by(Action.id.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

# Utility to reset database for evaluation run
@router.post("/api/reset")
async def reset_database(db: AsyncSession = Depends(get_db)):
    try:
        # Delete data from transaction tables
        await db.execute(delete(Action))
        await db.execute(delete(Email))
        await db.execute(delete(Thread))
        await db.execute(delete(Contact))
        await db.execute(delete(AuditLog))
        await db.execute(delete(WebIntelligenceCache))
        await db.commit()
        
        # Re-seed knowledge base
        from app.services.rag import seed_knowledge_base_if_empty
        await seed_knowledge_base_if_empty(db, force=True)
        await db.commit()
        
        return {"status": "success", "message": "Database resetted and knowledge base re-seeded."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"error_code": "RESET_ERROR", "message": "Failed to reset database", "details": str(e)}
        )

# 16. WebSockets and PubSub broadcast helpers
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket connection: {e}")

manager = ConnectionManager()

async def start_redis_listener():
    """Listens to the Redis crm_events channel and broadcasts to active WebSockets."""
    import asyncio
    import json
    from redis.asyncio import Redis
    from app.config import settings
    
    logger.info("Initializing Redis Pub/Sub WebSocket listener task...")
    try:
        redis_client = Redis.from_url(settings.REDIS_URL)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("crm_events")
        logger.info("Successfully subscribed to Redis channel 'crm_events' for WebSockets.")
        
        while True:
            # Check for messages
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = message["data"].decode("utf-8") if isinstance(message["data"], bytes) else message["data"]
                logger.info(f"Redis PubSub crm_events received: {data}")
                await manager.broadcast(data)
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        logger.info("Redis PubSub crm_events listener cancelled.")
    except Exception as e:
        logger.error(f"Error in Redis PubSub crm_events listener: {e}", exc_info=True)
        # Restart after sleep
        await asyncio.sleep(5)
        asyncio.create_task(start_redis_listener())

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive by waiting for message
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# 17. GET /analytics/fine-tuning-pairs
@router.get("/analytics/fine-tuning-pairs")
async def get_fine_tuning_pairs(db: AsyncSession = Depends(get_db)):
    try:
        # Fetch audit logs representing EDIT_DRAFT actions
        stmt = select(AuditLog).where(AuditLog.action == "EDIT_DRAFT").order_by(AuditLog.timestamp)
        res = await db.execute(stmt)
        logs = res.scalars().all()
        
        pairs = []
        for l in logs:
            diff_data = l.diff or {}
            old_c = diff_data.get("old_content") or ""
            new_c = diff_data.get("new_content") or ""
            
            if not old_c or not new_c:
                continue
                
            # Construct standard OpenAI message pair
            pairs.append({
                "messages": [
                    {"role": "system", "content": "You are a customer success AI agent helper. Draft professional holding replies, retention offers, and legal answers based on company policies."},
                    {"role": "user", "content": f"Please revise this draft to better fit customer needs. Original Draft:\n{old_c}"},
                    {"role": "assistant", "content": new_c}
                ]
            })
            
        if not pairs:
            # Provide some default training pairs for demonstration
            pairs = [
                {
                    "messages": [
                        {"role": "system", "content": "You are a customer success AI agent helper. Draft professional holding replies, retention offers, and legal answers based on company policies."},
                        {"role": "user", "content": "Please revise this draft to better fit customer needs. Original Draft:\nDear Bob,\n\nWe commit to a 99.9% Uptime SLA. Since the renewal is on hold, our Customer Success Director has been paged."},
                        {"role": "assistant", "content": "Dear Bob,\n\nWe acknowledge your message regarding the SLA breach from our October 1st outage and note the involvement of your legal team. Per our SLA Policy, we commit to a 99.9% Uptime SLA, and we are calculating the appropriate Service Credit. We also confirm that a full Root Cause Analysis (RCA) is being prepared. Since the renewal is on hold, our Customer Success Director and Legal Operations have been paged to resolve this with you directly.\n\nSincerely,\nOperations Support"}
                    ]
                },
                {
                    "messages": [
                        {"role": "system", "content": "You are a customer success AI agent helper. Draft professional holding replies, retention offers, and legal answers based on company policies."},
                        {"role": "user", "content": "Please revise this draft to better fit customer needs. Original Draft:\nDear Karen,\n\nWe apologize for the delay. We will give you a refund."},
                        {"role": "assistant", "content": "Dear Karen,\n\nWe apologize sincerely for the delay in responding to your refund requests. To make things right and assist with your platform experience, we would like to offer you a free month of service credit as well as a 20% discount on your next 3 billing cycles. Our Customer Success team has been paged to help audit your slow dashboard loading speeds.\n\nSincerely,\nCustomer Success"}
                    ]
                }
            ]
            
        return {"pairs": pairs}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error_code": "FINE_TUNING_ERROR", "message": "Failed to retrieve training pairs", "details": str(e)}
        )

