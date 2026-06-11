from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional

class AgentReasoningStep(BaseModel):
    thought: str
    action: str
    observation: str

class ActionDetail(BaseModel):
    id: int
    email_id: int
    agent_reasoning_log: List[Dict[str, Any]]
    action_type: str  # Auto-Reply | Escalate | Legal-Flag | Ticket-Created | Ignored
    proposed_content: Optional[str] = None
    is_approved: bool
    approved_by: Optional[str] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AgentDryRunResponse(BaseModel):
    email_id: int
    thread_id: str
    heuristics_flagged: bool
    sentiment_score: float
    category: str
    urgency: str
    requires_human: bool
    reasoning_trace: List[Dict[str, Any]]
    proposed_action: str
    suggested_reply: Optional[str] = None

class DraftEdit(BaseModel):
    proposed_content: str
