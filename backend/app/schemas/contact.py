from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class ContactResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    company: Optional[str] = None
    status: str  # VIP | Blocked | Active | Churned
    account_value: float
    churn_risk_score: float
    created_at: datetime
    last_contact_at: datetime

    class Config:
        from_attributes = True

class ContactStatusUpdate(BaseModel):
    status: str = Field(..., description="VIP, Blocked, Active, or Churned")
