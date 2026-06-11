from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Dict, List, Optional, Any

class EmailIngest(BaseModel):
    message_id: str = Field(..., description="Unique email identifier")
    sender: str = Field(..., description="Sender's email address")
    subject: str = Field("", description="Subject of the email")
    body: str = Field("", description="Body of the email")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="ISO format timestamp")
    thread_id: str = Field(..., description="Identifier linking emails in a conversation")

class EntityExtraction(BaseModel):
    order_ids: List[str] = Field(default_factory=list)
    ticket_ids: List[str] = Field(default_factory=list)
    monetary_amounts: List[str] = Field(default_factory=list)
    deadlines: List[str] = Field(default_factory=list)
    products_mentioned: List[str] = Field(default_factory=list)

class EmailDetail(BaseModel):
    id: int
    thread_id: str
    message_id: str
    sender: str
    subject: Optional[str] = None
    body: Optional[str] = None
    timestamp: datetime
    sentiment_score: float
    category: Optional[str] = None
    urgency: str
    requires_human: bool
    confidence: float
    raw_entities: Dict[str, Any]
    status: str

    class Config:
        from_attributes = True

class IngestResponse(BaseModel):
    job_id: str
    status: str
    message_id: str
    thread_id: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    email_id: Optional[int] = None
    error: Optional[str] = None
