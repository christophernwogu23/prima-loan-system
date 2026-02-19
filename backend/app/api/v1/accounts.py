from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.loan_application import LoanApplication
from app.models.payment import Payment
from app.models.savings import Savings
from app.models.transit_account import TransitDeposit  # NEW
from app.models.suspense_account import SuspensePayment  # NEW

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("/stats")
async def get_account_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overview stats for all accounts"""
    
    # Loans Account
    disbursed_loans = db.query(LoanApplication).filter(
        LoanApplication.status == "disbursed"
    ).all()
    
    total_disbursed = sum(loan.approved_amount or loan.requested_amount for loan in disbursed_loans)
    total_repaid = db.query(func.sum(Payment.amount)).scalar() or 0
    loans_balance = total_disbursed - total_repaid
    
    # Savings Account
    total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
    savings_count = db.query(func.count(Savings.id)).scalar() or 0
    
    # Transit Account - pending deposits
    pending_transit = db.query(TransitDeposit).filter(
        TransitDeposit.deposited_to_bank == False
    ).all()
    transit_balance = sum(d.amount for d in pending_transit)
    transit_count = len(pending_transit)
    
    # Suspense Account - unmatched payments
    unmatched_suspense = db.query(SuspensePayment).filter(
        SuspensePayment.matched == False,
        SuspensePayment.reversed == False
    ).all()
    suspense_balance = sum(p.amount for p in unmatched_suspense)
    suspense_count = len(unmatched_suspense)
    
    return {
        "loans": {
            "balance": loans_balance,
            "count": len(disbursed_loans)
        },
        "savings": {
            "balance": total_savings,
            "count": savings_count
        },
        "transit": {
            "balance": transit_balance,
            "count": transit_count
        },
        "suspense": {
            "balance": suspense_balance,
            "count": suspense_count
        }
    }