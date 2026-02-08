from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ExpenseCreate(BaseModel):
    category: str
    description: Optional[str] = None
    amount: float
    expense_date: Optional[datetime] = None

class ExpenseResponse(BaseModel):
    id: int
    category: str
    description: Optional[str]
    amount: float
    expense_date: datetime
    recorded_by: int
    created_at: datetime
    recorder_name: Optional[str] = None

    class Config:
        from_attributes = True