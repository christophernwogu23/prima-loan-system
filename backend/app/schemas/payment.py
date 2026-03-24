from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PaymentCreate(BaseModel):
    loan_application_id: int
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[str] = None  

class PaymentResponse(BaseModel):
    id: int
    loan_application_id: int
    amount: float
    payment_date: datetime
    payment_method: str
    reference_number: Optional[str]
    notes: Optional[str]
    recorded_by: int
    created_at: datetime

    class Config:
        from_attributes = True

class PaymentWithDetails(PaymentResponse):
    customer_name: Optional[str] = None
    loan_product_name: Optional[str] = None
    loan_amount: Optional[float] = None