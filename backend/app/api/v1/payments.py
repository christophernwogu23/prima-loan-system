from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.payment import Payment
from app.models.loan_application import LoanApplication, ApplicationStatus
from app.models.loan_product import LoanProduct
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentWithDetails

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/", response_model=PaymentResponse)
def create_payment(
    payment: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new payment"""
    # Verify loan exists and is disbursed
    loan = db.query(LoanApplication).filter(
        LoanApplication.id == payment.loan_application_id
    ).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan application not found")
    
    if loan.status != "disbursed":
        raise HTTPException(status_code=400, detail="Can only record payments for disbursed loans")
    
    # Loan officers can only create payments for their assigned customers
    if current_user.role == "loan_officer":
        if loan.assigned_officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied - loan not assigned to you")
    
    # Create payment
    db_payment = Payment(
        loan_application_id=payment.loan_application_id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        reference_number=payment.reference_number,
        notes=payment.notes,
        recorded_by=current_user.id
    )
    
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    
    return db_payment

@router.get("/", response_model=List[PaymentWithDetails])
def get_payments(
    month: Optional[str] = Query(None, regex="^\\d{4}-\\d{2}$"),
    officer_id: Optional[int] = Query(None, description="Filter by loan officer (for managers/CEO/admin)"),
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
    
    # Role-based filtering
    if current_user.role == "customer":
        # Customers only see their own payments
        query = query.filter(LoanApplication.customer_id == current_user.id)
    
    elif current_user.role == "loan_officer":
        # Loan officers only see payments from their assigned customers
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)
    
    elif current_user.role in ["manager", "ceo", "admin"]:
        # Managers/CEO/Admin can filter by specific officer
        if officer_id:
            query = query.filter(LoanApplication.assigned_officer_id == officer_id)
    
    # Month filtering
    if month:
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month_num + 1, 1)
        
        query = query.filter(
            Payment.payment_date >= start_date,
            Payment.payment_date < end_date
        )
    
    results = query.order_by(Payment.payment_date.desc()).all()
    
    payments = []
    for payment, first_name, last_name, product_name, loan_amount in results:
        payment_dict = {
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
        }
        payments.append(payment_dict)
    
    return payments

@router.get("/loan/{loan_id}", response_model=List[PaymentResponse])
def get_loan_payments(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payments for a specific loan"""
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Check permissions
    if current_user.role == "customer" and loan.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "loan_officer" and loan.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied - loan not assigned to you")
    
    payments = db.query(Payment).filter(
        Payment.loan_application_id == loan_id
    ).order_by(Payment.payment_date.desc()).all()
    
    return payments

@router.get("/summary/{loan_id}")
def get_loan_payment_summary(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment summary for a specific loan"""
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Check permissions
    if current_user.role == "customer" and loan.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == "loan_officer" and loan.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied - loan not assigned to you")
    
    total_paid = db.query(func.sum(Payment.amount)).filter(
        Payment.loan_application_id == loan_id
    ).scalar() or 0
    
    payment_count = db.query(func.count(Payment.id)).filter(
        Payment.loan_application_id == loan_id
    ).scalar()
    
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
    """Get all disbursed loans for the payment dropdown"""
    query = db.query(
        LoanApplication,
        User.first_name,
        User.last_name,
        LoanProduct.name.label("product_name")
    ).join(
        User, LoanApplication.customer_id == User.id
    ).join(
        LoanProduct, LoanApplication.loan_product_id == LoanProduct.id
    ).filter(
        LoanApplication.status == ApplicationStatus.DISBURSED
    )
    
    # Loan officers only see their assigned customers' loans
    if current_user.role == "loan_officer":
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)
    
    results = query.all()
    
    loans = []
    for loan, first_name, last_name, product_name in results:
        total_paid = db.query(func.sum(Payment.amount)).filter(
            Payment.loan_application_id == loan.id
        ).scalar() or 0
        
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
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a payment"""
    # Only admin and CEO can edit payments
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can edit payments")
    
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Update allowed fields
    allowed_fields = ['amount', 'payment_method', 'reference_number', 'notes']
    for key, value in update_data.items():
        if key in allowed_fields and hasattr(payment, key):
            setattr(payment, key, value)
    
    db.commit()
    db.refresh(payment)
    return payment

@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a payment"""
    # Only admin and CEO can delete payments
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can delete payments")
    
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted successfully", "id": payment_id}