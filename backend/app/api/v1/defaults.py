from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.loan_application import LoanApplication
from app.models.payment import Payment

router = APIRouter(prefix="/defaults", tags=["defaults"])

@router.get("")
async def get_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all loans in default (missed monthly payment)"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all disbursed loans
    loans = db.query(LoanApplication).filter(
        LoanApplication.status == "DISBURSED"
    ).all()
    
    defaults = []
    today = datetime.now()
    
    for loan in loans:
        # Get the last payment for this loan
        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()
        
        # Determine the reference date (last payment or disbursement)
        if last_payment:
            last_date = last_payment.payment_date
        else:
            # No payments yet - use created_at as disbursement date
            last_date = loan.created_at
        
        # Calculate days since last payment
        days_overdue = (today - last_date).days
        
        # If more than 30 days since last payment, it's a default
        if days_overdue > 30:
            # Get customer info
            customer = db.query(User).filter(User.id == loan.customer_id).first()
            
            # Calculate months overdue
            months_overdue = days_overdue // 30
            
            defaults.append({
                "loan_id": loan.id,
                "application_number": loan.application_number,
                "customer_id": loan.customer_id,
                "customer_name": f"{customer.first_name} {customer.last_name}" if customer else "Unknown",
                "customer_email": customer.email if customer else "",
                "loan_amount": loan.approved_amount or loan.requested_amount,
                "balance": loan.approved_amount or loan.requested_amount,  # You may want to calculate actual balance
                "last_payment_date": last_date.isoformat() if last_date else None,
                "days_overdue": days_overdue,
                "months_overdue": months_overdue,
                "officer_id": loan.assigned_officer_id
            })
    
    # Sort by days overdue (most overdue first)
    defaults.sort(key=lambda x: x["days_overdue"], reverse=True)
    
    return defaults

@router.get("/summary")
async def get_defaults_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get defaults summary stats"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get all disbursed loans
    loans = db.query(LoanApplication).filter(
        LoanApplication.status == "DISBURSED"
    ).all()
    
    today = datetime.now()
    total_defaults = 0
    total_default_amount = 0
    
    for loan in loans:
        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()
        
        if last_payment:
            last_date = last_payment.payment_date
        else:
            last_date = loan.created_at
        
        days_overdue = (today - last_date).days
        
        if days_overdue > 30:
            total_defaults += 1
            total_default_amount += loan.approved_amount or loan.requested_amount or 0
    
    total_disbursed = len(loans)
    default_rate = (total_defaults / total_disbursed * 100) if total_disbursed > 0 else 0
    
    return {
        "total_defaults": total_defaults,
        "total_default_amount": total_default_amount,
        "total_disbursed_loans": total_disbursed,
        "default_rate": round(default_rate, 2)
    }