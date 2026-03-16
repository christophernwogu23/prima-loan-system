from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models import User
from app.core.security import get_password_hash
from sqlalchemy import func
from app.models.loan_application import LoanApplication
from app.models.payment import Payment

router = APIRouter(prefix="/users", tags=["Users"])

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    status: str
    phone: Optional[str] = None
    address: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str = "customer"

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

@router.get("/", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    officer_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get users with role-based filtering"""
    if current_user.role == "loan_officer":
        query = db.query(User).filter(
            User.assigned_officer_id == current_user.id,
            User.role == "customer"
        )
        if search:
            s = f"%{search}%"
            query = query.filter(
                (User.first_name.ilike(s)) | (User.last_name.ilike(s)) |
                (User.middle_name.ilike(s)) | (User.email.ilike(s))
            )
        return query.all()

    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(User)
    if officer_id:
        query = query.filter(User.assigned_officer_id == officer_id)
    if role:
        query = query.filter(User.role == role)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(s)) | (User.last_name.ilike(s)) |
            (User.middle_name.ilike(s)) | (User.email.ilike(s))
        )
    return query.all()


@router.get("/{user_id}/financial-summary")
async def get_user_financial_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get financial summary for a customer"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "loan_officer":
        if user.assigned_officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied - customer not assigned to you")

    loans = db.query(LoanApplication).filter(LoanApplication.customer_id == user_id).all()

    total_borrowed = sum(
        loan.approved_amount or loan.requested_amount
        for loan in loans if loan.status == "disbursed"
    )

    loan_ids = [loan.id for loan in loans]
    total_repaid = db.query(func.sum(Payment.amount)).filter(
        Payment.loan_application_id.in_(loan_ids)
    ).scalar() or 0

    risk_score = 18.0
    defaults_count = 0
    for loan in loans:
        if loan.status == "disbursed":
            last_payment = db.query(Payment).filter(
                Payment.loan_application_id == loan.id
            ).order_by(Payment.payment_date.desc()).first()
            days_since = (datetime.now() - last_payment.payment_date).days if last_payment else (
                (datetime.now() - loan.created_at).days if loan.created_at else 0
            )
            if days_since > 30:
                defaults_count += 1
                risk_score -= 3

    if total_borrowed > 0:
        repayment_ratio = total_repaid / total_borrowed
        if repayment_ratio < 0.5:
            risk_score -= 2
        elif repayment_ratio < 0.75:
            risk_score -= 1

    if len(loans) > 5:
        risk_score -= 1

    risk_score = max(0, min(20, risk_score))

    return {
        "user_id": user_id,
        "total_borrowed": total_borrowed,
        "total_repaid": total_repaid,
        "outstanding_balance": total_borrowed - total_repaid,
        "risk_score": round(risk_score, 2),
        "defaults_count": defaults_count,
        "total_loans": len(loans),
        "active_loans": len([l for l in loans if l.status == "disbursed"])
    }


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "customer" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role == "loan_officer":
        if user.role == "customer" and user.assigned_officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied - customer not assigned to you")

    return user


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user"""
    # Managers can only create customer accounts
    if current_user.role == "manager":
        if user_data.role != "customer":
            raise HTTPException(status_code=403, detail="Managers can only create customer accounts")
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin or manager can create users")

    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_roles = ["admin", "ceo", "manager", "loan_officer", "customer"]
    if user_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        status="active"
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    user_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a user"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field in ["first_name", "last_name", "email", "role", "status", "assigned_officer_id"]:
        if field in user_data:
            setattr(user, field, user_data[field])

    if "password" in user_data and user_data["password"]:
        user.hashed_password = get_password_hash(user_data["password"])

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/assign-officer")
async def assign_officer(
    user_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a loan officer to a customer"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    customer = db.query(User).filter(User.id == user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.assigned_officer_id = data.get("officer_id")
    db.commit()
    return {"message": "Officer assigned"}


@router.post("/bulk-assign-officer")
async def bulk_assign_officer(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk assign loan officer to multiple customers"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    customer_ids = data.get("customer_ids", [])
    officer_id = data.get("officer_id")

    db.query(User).filter(User.id.in_(customer_ids)).update(
        {"assigned_officer_id": officer_id}, synchronize_session=False
    )
    db.commit()
    return {"message": f"{len(customer_ids)} customers assigned"}


@router.post("/sync-officers-from-loans")
async def sync_officers_from_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync customer officer assignments from their loan records"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    loans = db.query(LoanApplication).filter(
        LoanApplication.assigned_officer_id.isnot(None)
    ).all()

    updated = 0
    for loan in loans:
        customer = db.query(User).filter(User.id == loan.customer_id).first()
        if customer and customer.assigned_officer_id != loan.assigned_officer_id:
            customer.assigned_officer_id = loan.assigned_officer_id
            updated += 1

    db.commit()
    return {"updated": updated, "message": f"{updated} customers updated from loan records"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a user"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "customer":
        active_loans = db.query(LoanApplication).filter(
            LoanApplication.customer_id == user_id,
            LoanApplication.status.in_(["pending", "under_review", "approved", "disbursed"])
        ).count()
        if active_loans > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete user with {active_loans} active loan(s). Close or reject loans first."
            )

    # Delete savings before deleting user (FK constraint)
    from app.models.savings import Savings
    db.query(Savings).filter(Savings.user_id == user_id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully", "deleted_user_id": user_id}