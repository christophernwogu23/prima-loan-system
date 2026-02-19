from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.suspense_account import SuspensePayment
from app.models.loan_application import LoanApplication
from app.models.payment import Payment

router = APIRouter(prefix="/suspense", tags=["Suspense Account"])

class SuspensePaymentCreate(BaseModel):
    amount: float
    payment_date: Optional[datetime] = None
    payment_method: str
    reference_number: Optional[str] = None
    payer_info: Optional[str] = None
    notes: Optional[str] = None

class SuspensePaymentResponse(BaseModel):
    id: int
    amount: float
    payment_date: datetime
    payment_method: str
    reference_number: Optional[str]
    payer_info: Optional[str]
    notes: Optional[str]
    matched: bool
    matched_customer_id: Optional[int]
    matched_loan_id: Optional[int]
    reversed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/", response_model=SuspensePaymentResponse)
async def create_suspense_payment(
    payment: SuspensePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record an unidentified payment to suspense account"""
    
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    suspense_payment = SuspensePayment(
        amount=payment.amount,
        payment_date=payment.payment_date or datetime.utcnow(),
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        payer_info=payment.payer_info,
        notes=payment.notes,
        recorded_by=current_user.id
    )
    
    db.add(suspense_payment)
    db.commit()
    db.refresh(suspense_payment)
    
    return suspense_payment

@router.get("/", response_model=List[SuspensePaymentResponse])
async def get_suspense_payments(
    show_matched: bool = False,
    show_reversed: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all suspense payments"""
    
    if current_user.role not in ["admin", "manager", "ceo", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(SuspensePayment)
    
    # Filter by status
    if not show_matched and not show_reversed:
        # Show only unmatched and not reversed
        query = query.filter(
            SuspensePayment.matched == False,
            SuspensePayment.reversed == False
        )
    elif show_matched and not show_reversed:
        query = query.filter(SuspensePayment.matched == True)
    elif show_reversed:
        query = query.filter(SuspensePayment.reversed == True)
    
    payments = query.order_by(SuspensePayment.payment_date.desc()).all()
    
    return payments

@router.post("/{payment_id}/match")
async def match_suspense_payment(
    payment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Match suspense payment to a customer and loan"""
    
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admin and manager can match payments")
    
    suspense = db.query(SuspensePayment).filter(SuspensePayment.id == payment_id).first()
    
    if not suspense:
        raise HTTPException(status_code=404, detail="Suspense payment not found")
    
    if suspense.matched:
        raise HTTPException(status_code=400, detail="Payment already matched")
    
    if suspense.reversed:
        raise HTTPException(status_code=400, detail="Cannot match reversed payment")
    
    customer_id = data.get("customer_id")
    loan_id = data.get("loan_id")
    
    # Verify customer exists
    customer = db.query(User).filter(User.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Verify loan exists and belongs to customer
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    if loan.customer_id != customer_id:
        raise HTTPException(status_code=400, detail="Loan does not belong to this customer")
    
    # Create actual payment record
    actual_payment = Payment(
        loan_application_id=loan_id,
        amount=suspense.amount,
        payment_method=suspense.payment_method,
        reference_number=suspense.reference_number,
        notes=f"Transferred from suspense account. Original ref: {suspense.reference_number or 'N/A'}",
        recorded_by=current_user.id
    )
    
    db.add(actual_payment)
    
    # Mark suspense as matched
    suspense.matched = True
    suspense.matched_customer_id = customer_id
    suspense.matched_loan_id = loan_id
    suspense.matched_date = datetime.utcnow()
    suspense.matched_by = current_user.id
    
    db.commit()
    
    return {"message": "Payment matched and transferred successfully"}

@router.post("/{payment_id}/reverse")
async def reverse_suspense_payment(
    payment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reverse a suspense payment"""
    
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admin and manager can reverse payments")
    
    suspense = db.query(SuspensePayment).filter(SuspensePayment.id == payment_id).first()
    
    if not suspense:
        raise HTTPException(status_code=404, detail="Suspense payment not found")
    
    if suspense.reversed:
        raise HTTPException(status_code=400, detail="Payment already reversed")
    
    if suspense.matched:
        raise HTTPException(status_code=400, detail="Cannot reverse matched payment. Unmatch first.")
    
    suspense.reversed = True
    suspense.reversal_date = datetime.utcnow()
    suspense.reversal_reason = data.get("reason", "")
    suspense.reversed_by = current_user.id
    
    db.commit()
    
    return {"message": "Payment reversed successfully"}

@router.get("/stats")
async def get_suspense_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get suspense account statistics"""
    
    if current_user.role not in ["admin", "manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Unmatched payments
    unmatched = db.query(SuspensePayment).filter(
        SuspensePayment.matched == False,
        SuspensePayment.reversed == False
    ).all()
    
    unmatched_balance = sum(p.amount for p in unmatched)
    unmatched_count = len(unmatched)
    
    # Matched payments
    matched_count = db.query(func.count(SuspensePayment.id)).filter(
        SuspensePayment.matched == True
    ).scalar() or 0
    
    # Reversed payments
    reversed_count = db.query(func.count(SuspensePayment.id)).filter(
        SuspensePayment.reversed == True
    ).scalar() or 0
    
    return {
        "unmatched_balance": unmatched_balance,
        "unmatched_count": unmatched_count,
        "matched_count": matched_count,
        "reversed_count": reversed_count
    }

@router.delete("/{payment_id}")
async def delete_suspense_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a suspense payment"""
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete suspense payments")
    
    payment = db.query(SuspensePayment).filter(SuspensePayment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Suspense payment not found")
    
    if payment.matched:
        raise HTTPException(status_code=400, detail="Cannot delete matched payment")
    
    db.delete(payment)
    db.commit()
    
    return {"message": "Suspense payment deleted successfully"}