from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Numeric, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.db.session import Base

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    company = Column(String, nullable=True)
    status = Column(String, default="Active")  # VIP | Blocked | Active | Churned
    account_value = Column(Numeric(12, 2), default=0.00)
    churn_risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=func.now())
    last_contact_at = Column(DateTime, default=func.now(), onupdate=func.now())

    threads = relationship("Thread", back_populates="contact", primaryjoin="Contact.email == Thread.sender_email")

class Thread(Base):
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(String, unique=True, nullable=False, index=True)
    subject = Column(String, nullable=True)
    sender_email = Column(String, ForeignKey("contacts.email"), nullable=False, index=True)
    first_seen_at = Column(DateTime, default=func.now())
    last_updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    status = Column(String, default="Open")  # Open | Resolved | Escalated | Ignored
    assigned_to = Column(String, nullable=True)

    contact = relationship("Contact", back_populates="threads")
    emails = relationship("Email", back_populates="thread")

class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(String, ForeignKey("threads.thread_id"), nullable=False, index=True)
    message_id = Column(String, unique=True, nullable=False, index=True)
    sender = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=func.now())
    sentiment_score = Column(Float, default=0.0)
    category = Column(String, nullable=True)  # Complaint | Inquiry | Bug Report | Feature Request | Compliance | Legal | Billing | Spam | Internal | Other
    urgency = Column(String, default="Medium")  # Critical | High | Medium | Low
    requires_human = Column(Boolean, default=False)
    confidence = Column(Float, default=1.0)
    raw_entities = Column(JSONB, default=dict)  # order_ids, ticket_ids, monetary_amounts, deadlines, products
    status = Column(String, default="Received")  # Received | Processing | Replied | Escalated | Ignored

    thread = relationship("Thread", back_populates="emails")
    actions = relationship("Action", back_populates="email")

class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False, index=True)
    agent_reasoning_log = Column(JSONB, default=list)  # Thought -> Action -> Observation steps
    action_type = Column(String, nullable=False)  # Auto-Reply | Escalate | Legal-Flag | Ticket-Created | Ignored
    proposed_content = Column(Text, nullable=True)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    email = relationship("Email", back_populates="actions")

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_doc = Column(String, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=False)  # 1536 dimensions for standard OpenAI embedding models
    created_at = Column(DateTime, default=func.now())

class WebIntelligenceCache(Base):
    __tablename__ = "web_intelligence_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_url = Column(String, nullable=False, index=True)
    target_entity = Column(String, nullable=False, index=True)
    scraped_data = Column(JSONB, default=dict)
    scraped_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=False, index=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False)  # contacts, threads, emails, actions
    entity_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    performed_by = Column(String, default="agent")  # agent | user_id
    timestamp = Column(DateTime, default=func.now())
    diff = Column(JSONB, default=dict)

# Performance indexes
Index("idx_emails_timestamp", Email.timestamp)
Index("idx_threads_last_updated", Thread.last_updated_at)
Index("idx_audit_logs_timestamp", AuditLog.timestamp)
Index("idx_web_cache_expires", WebIntelligenceCache.expires_at)
