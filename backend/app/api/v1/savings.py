from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.savings import Savings
from app.schemas.savings import SavingsUpdate, SavingsResponse

router = APIRouter(prefix="/savings", tags=["savings"])


class TransactionRequest(BaseModel):
    user_id: Optional[int] = None  # Staff pass user_id; customers omit it
    amount: float
    note: Optional[str] = None


@router.get("/my-balance")
def get_my_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    savings = db.query(Savings).filter(Savings.user_id == current_user.id).first()
    return {"balance": savings.balance if savings else 0.0}


@router.get("/", response_model=List[SavingsResponse])
def get_all_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    savings = db.query(Savings).all()
    return savings


@router.get("/user/{user_id}")
def get_user_savings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "customer" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    savings = db.query(Savings).filter(Savings.user_id == user_id).first()
    return {"user_id": user_id, "balance": savings.balance if savings else 0.0}


@router.post("/deposit")
def deposit_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine target user
    if current_user.role == "customer":
        target_user_id = current_user.id  # Customers always deposit into their own account
    elif current_user.role in ["admin", "manager", "loan_officer"]:
        if not data.user_id:
            raise HTTPException(status_code=400, detail="user_id is required for staff")
        target_user_id = data.user_id
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    savings = db.query(Savings).filter(Savings.user_id == target_user_id).first()
    if savings:
        savings.balance += data.amount
    else:
        savings = Savings(user_id=target_user_id, balance=data.amount)
        db.add(savings)

    db.commit()
    db.refresh(savings)
    return {"message": "Deposit successful", "new_balance": savings.balance}


@router.post("/withdraw")
def withdraw_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine target user
    if current_user.role == "customer":
        target_user_id = current_user.id
    elif current_user.role in ["admin", "manager", "loan_officer"]:
        if not data.user_id:
            raise HTTPException(status_code=400, detail="user_id is required for staff")
        target_user_id = data.user_id
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    savings = db.query(Savings).filter(Savings.user_id == target_user_id).first()
    if not savings or savings.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    savings.balance -= data.amount
    db.commit()
    db.refresh(savings)
    return {"message": "Withdrawal successful", "new_balance": savings.balance}


@router.get("/summary")
def get_savings_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    total = db.query(func.sum(Savings.balance)).scalar() or 0
    count = db.query(func.count(Savings.id)).scalar() or 0
    return {"total_savings": total, "accounts_count": count}


@router.delete("/{user_id}")
def delete_savings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete savings accounts")
    savings = db.query(Savings).filter(Savings.user_id == user_id).first()
    if not savings:
        raise HTTPException(status_code=404, detail="Savings account not found")
    db.delete(savings)
    db.commit()
    return {"message": "Savings account deleted"}