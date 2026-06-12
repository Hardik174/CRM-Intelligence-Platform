from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from app.schemas.email import EmailDetail

class ThreadResponse(BaseModel):
    id: int
    thread_id: str
    subject: Optional[str] = None
    sender_email: str
    first_seen_at: datetime
    last_updated_at: datetime
    status: str
    assigned_to: Optional[str] = None
    summary: Optional[str] = None
    emails: List[EmailDetail] = []

    class Config:
        from_attributes = True

class ThreadSummary(BaseModel):
    id: int
    thread_id: str
    subject: Optional[str] = None
    sender_email: str
    first_seen_at: datetime
    last_updated_at: datetime
    status: str
    assigned_to: Optional[str] = None
    last_email_body: Optional[str] = None
    email_count: int
    sentiment_average: float

    class Config:
        from_attributes = True
