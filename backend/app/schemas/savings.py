from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SavingsUpdate(BaseModel):
    user_id: int
    amount: float  # positive = deposit, negative = withdrawal

class SavingsResponse(BaseModel):
    id: int
    user_id: int
    balance: float
    updated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True