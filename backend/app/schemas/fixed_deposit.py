from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FixedDepositCreate(BaseModel):
    depositor_name: str
    amount: float
    interest_amount: float
    value_date: datetime
    maturity_date: datetime
    duration: Optional[str] = None
    notes: Optional[str] = None

class FixedDepositUpdate(BaseModel):
    depositor_name: Optional[str] = None
    amount: Optional[float] = None
    interest_amount: Optional[float] = None
    value_date: Optional[datetime] = None
    maturity_date: Optional[datetime] = None
    duration: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class FixedDepositResponse(BaseModel):
    id: int
    depositor_name: str
    amount: float
    interest_amount: float
    value_date: datetime
    maturity_date: datetime
    duration: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True