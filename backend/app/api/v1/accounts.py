from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.loan_application import LoanApplication
from app.models.payment import Payment
from app.models.savings import Savings
from app.models.transit_account import TransitDeposit
from app.models.suspense_account import SuspensePayment

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("/stats")
async def get_account_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive stats for all accounts"""
    
    # ===== LOANS ACCOUNT =====
    disbursed_loans = db.query(LoanApplication).filter(
        LoanApplication.status == "disbursed"
    ).all()
    
    total_disbursed = sum(loan.approved_amount or loan.requested_amount for loan in disbursed_loans)
    total_repaid = db.query(func.sum(Payment.amount)).scalar() or 0
    loans_balance = total_disbursed - total_repaid
    
    # ===== SAVINGS ACCOUNT =====
    total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
    savings_count = db.query(func.count(Savings.id)).scalar() or 0
    
    # ===== TRANSIT ACCOUNT =====
    # Pending deposits (not yet banked)
    pending_transit = db.query(TransitDeposit).filter(
        TransitDeposit.deposited_to_bank == False
    ).all()
    transit_balance = sum(d.amount for d in pending_transit)
    transit_pending_count = len(pending_transit)
    
    # Total all time (including banked)
    total_transit_amount = db.query(func.sum(TransitDeposit.amount)).scalar() or 0
    total_transit_count = db.query(func.count(TransitDeposit.id)).scalar() or 0
    
    # ===== SUSPENSE ACCOUNT =====
    # Unmatched payments (not matched and not reversed)
    unmatched_suspense = db.query(SuspensePayment).filter(
        SuspensePayment.matched == False,
        SuspensePayment.reversed == False
    ).all()
    suspense_balance = sum(p.amount for p in unmatched_suspense)
    suspense_unmatched_count = len(unmatched_suspense)
    
    # Matched count
    matched_count = db.query(func.count(SuspensePayment.id)).filter(
        SuspensePayment.matched == True
    ).scalar() or 0
    
    # Reversed count
    reversed_count = db.query(func.count(SuspensePayment.id)).filter(
        SuspensePayment.reversed == True
    ).scalar() or 0
    
    return {
        "loans": {
            "balance": loans_balance,  # Outstanding
            "count": len(disbursed_loans),  # Active loans
            "total_disbursed": total_disbursed,
            "total_repaid": total_repaid
        },
        "savings": {
            "balance": total_savings,  # Total savings balance
            "count": savings_count  # Number of accounts
        },
        "transit": {
            "balance": transit_balance,  # Pending balance
            "count": transit_pending_count,  # Pending deposits
            "total_amount": total_transit_amount,  # All time total
            "total_count": total_transit_count  # All time count
        },
        "suspense": {
            "balance": suspense_balance,  # Unmatched balance
            "count": suspense_unmatched_count,  # Unmatched count
            "matched_count": matched_count,
            "reversed_count": reversed_count
        }
    }