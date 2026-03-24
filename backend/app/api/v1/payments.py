from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.payment import Payment
from app.models.loan_application import LoanApplication, ApplicationStatus
from app.models.loan_product import LoanProduct
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentWithDetails

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[str] = None  # ISO format: "2025-01-15"


@router.post("/", response_model=PaymentResponse)
def create_payment(
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new payment"""
    loan = db.query(LoanApplication).filter(
        LoanApplication.id == payment.loan_application_id
    ).first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan application not found")

    if loan.status != "disbursed":
        raise HTTPException(status_code=400, detail="Can only record payments for disbursed loans")

    if current_user.role == "loan_officer":
        if loan.assigned_officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied - loan not assigned to you")

    # Savings account deduction
    if payment.payment_method == "savings_account":
        from app.models.savings import Savings
        savings = db.query(Savings).filter(Savings.user_id == loan.customer_id).first()
        if not savings:
            raise HTTPException(status_code=400, detail="Customer has no savings account")
        if savings.balance < payment.amount:
            raise HTTPException(status_code=400, detail=f"Insufficient savings balance. Available: ₦{savings.balance:,.2f}")
        savings.balance -= payment.amount
        db.add(savings)

    # Parse payment date — use provided date or default to now
    if hasattr(payment, 'payment_date') and payment.payment_date:
        try:
            payment_dt = datetime.strptime(payment.payment_date, "%Y-%m-%d")
        except ValueError:
            payment_dt = datetime.utcnow()
    else:
        payment_dt = datetime.utcnow()

    db_payment = Payment(
        loan_application_id=payment.loan_application_id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        notes=payment.notes,
        recorded_by=current_user.id,
        payment_date=payment_dt
    )

    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)

    # Auto GL entry
    try:
        from app.api.v1.general_ledger import auto_create_journal_entry
        auto_create_journal_entry(
            db=db,
            debit_account_code="1001",  # Bank Account
            credit_account_code="1003",  # Loans Receivable
            amount=payment.amount,
            description=f"Payment received - {loan.application_number}",
            reference=f"PMT-{db_payment.id}",
            created_by_id=current_user.id
        )
    except Exception as e:
        print(f"⚠️ Failed to create GL entry: {e}")

    return db_payment


@router.get("/", response_model=List[PaymentWithDetails])
def get_payments(
    month: Optional[str] = Query(None, regex="^\\d{4}-\\d{2}$"),
    officer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payments with role-based filtering"""
    query = db.query(
        Payment,
        User.first_name,
        User.last_name,
        LoanProduct.name.label("loan_product_name"),
        LoanApplication.requested_amount.label("loan_amount")
    ).join(
        LoanApplication, Payment.loan_application_id == LoanApplication.id
    ).join(
        User, LoanApplication.customer_id == User.id
    ).join(
        LoanProduct, LoanApplication.loan_product_id == LoanProduct.id
    )

    if current_user.role == "customer":
        query = query.filter(LoanApplication.customer_id == current_user.id)
    elif current_user.role == "loan_officer":
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)
    elif current_user.role in ["manager", "ceo", "admin"]:
        if officer_id:
            query = query.filter(LoanApplication.assigned_officer_id == officer_id)

    if month:
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1)
        end_date = datetime(year + 1, 1, 1) if month_num == 12 else datetime(year, month_num + 1, 1)
        query = query.filter(
            Payment.payment_date >= start_date,
            Payment.payment_date < end_date
        )

    results = query.order_by(Payment.payment_date.desc()).all()

    return [{
        "id": payment.id,
        "loan_application_id": payment.loan_application_id,
        "amount": payment.amount,
        "payment_date": payment.payment_date,
        "payment_method": payment.payment_method,
        "reference_number": payment.reference_number,
        "notes": payment.notes,
        "recorded_by": payment.recorded_by,
        "created_at": payment.created_at,
        "customer_name": f"{first_name} {last_name}",
        "loan_product_name": product_name,
        "loan_amount": loan_amount
    } for payment, first_name, last_name, product_name, loan_amount in results]


@router.get("/loan/{loan_id}", response_model=List[PaymentResponse])
def get_loan_payments(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role == "customer" and loan.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "loan_officer" and loan.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Payment).filter(Payment.loan_application_id == loan_id).order_by(Payment.payment_date.desc()).all()


@router.get("/summary/{loan_id}")
def get_loan_payment_summary(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if current_user.role == "customer" and loan.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "loan_officer" and loan.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    total_paid = db.query(func.sum(Payment.amount)).filter(Payment.loan_application_id == loan_id).scalar() or 0
    payment_count = db.query(func.count(Payment.id)).filter(Payment.loan_application_id == loan_id).scalar()

    return {
        "loan_id": loan_id,
        "loan_amount": loan.requested_amount,
        "total_paid": total_paid,
        "remaining_balance": loan.requested_amount - total_paid,
        "payment_count": payment_count,
        "is_fully_paid": total_paid >= loan.requested_amount
    }


@router.get("/disbursed-loans")
def get_disbursed_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        LoanApplication, User.first_name, User.last_name, LoanProduct.name.label("product_name")
    ).join(User, LoanApplication.customer_id == User.id
    ).join(LoanProduct, LoanApplication.loan_product_id == LoanProduct.id
    ).filter(LoanApplication.status == ApplicationStatus.DISBURSED)

    if current_user.role == "loan_officer":
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)

    results = query.all()
    loans = []
    for loan, first_name, last_name, product_name in results:
        total_paid = db.query(func.sum(Payment.amount)).filter(Payment.loan_application_id == loan.id).scalar() or 0
        loans.append({
            "id": loan.id,
            "customer_name": f"{first_name} {last_name}",
            "product_name": product_name,
            "amount": loan.requested_amount,
            "total_paid": total_paid,
            "remaining": loan.requested_amount - total_paid
        })
    return loans


@router.put("/{payment_id}")
def update_payment(
    payment_id: int,
    update_data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a payment"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can edit payments")

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if update_data.amount is not None:
        payment.amount = update_data.amount
    if update_data.payment_method is not None:
        payment.payment_method = update_data.payment_method
    if update_data.reference_number is not None:
        payment.reference_number = update_data.reference_number
    if update_data.notes is not None:
        payment.notes = update_data.notes
    if update_data.payment_date:
        try:
            payment.payment_date = datetime.strptime(update_data.payment_date, "%Y-%m-%d")
        except ValueError:
            pass

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can delete payments")
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted successfully", "id": payment_id}