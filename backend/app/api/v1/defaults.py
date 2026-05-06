from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
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
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    loans = db.query(LoanApplication).filter(
        LoanApplication.status == "DISBURSED"
    ).all()

    defaults = []
    today = datetime.now()

    for loan in loans:
        loan_amount = loan.approved_amount or loan.requested_amount or 0

        # Calculate how much has been paid
        total_paid = db.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.loan_application_id == loan.id
        ).scalar() or 0

        remaining_balance = loan_amount - total_paid

        # ✅ Skip fully liquidated loans
        if remaining_balance <= 0:
            continue

        # Get last payment date
        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()

        last_date = last_payment.payment_date if last_payment else loan.created_at
        days_overdue = (today - last_date).days

        if days_overdue > 30:
            customer = db.query(User).filter(User.id == loan.customer_id).first()
            months_overdue = days_overdue // 30

            defaults.append({
                "loan_id": loan.id,
                "application_number": loan.application_number,
                "customer_id": loan.customer_id,
                "customer_name": f"{customer.first_name} {customer.last_name}" if customer else "Unknown",
                "customer_email": customer.email if customer else "",
                "loan_amount": loan_amount,
                "total_paid": total_paid,
                "balance": remaining_balance,   # ✅ Actual remaining, not full amount
                "last_payment_date": last_date.isoformat() if last_date else None,
                "days_overdue": days_overdue,
                "months_overdue": months_overdue,
                "officer_id": loan.assigned_officer_id
            })

    defaults.sort(key=lambda x: x["days_overdue"], reverse=True)
    return defaults


@router.get("/summary")
async def get_defaults_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    loans = db.query(LoanApplication).filter(
        LoanApplication.status == "DISBURSED"
    ).all()

    today = datetime.now()
    total_defaults = 0
    total_default_amount = 0

    for loan in loans:
        loan_amount = loan.approved_amount or loan.requested_amount or 0

        total_paid = db.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.loan_application_id == loan.id
        ).scalar() or 0

        remaining_balance = loan_amount - total_paid

        # ✅ Skip fully paid loans
        if remaining_balance <= 0:
            continue

        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()

        last_date = last_payment.payment_date if last_payment else loan.created_at
        days_overdue = (today - last_date).days

        if days_overdue > 30:
            total_defaults += 1
            total_default_amount += remaining_balance  # ✅ Use remaining, not full amount

    total_disbursed = len(loans)
    default_rate = (total_defaults / total_disbursed * 100) if total_disbursed > 0 else 0

    return {
        "total_defaults": total_defaults,
        "total_default_amount": total_default_amount,
        "total_disbursed_loans": total_disbursed,
        "default_rate": round(default_rate, 2)
    }