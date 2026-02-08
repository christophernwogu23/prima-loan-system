from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.savings import Savings
from app.schemas.savings import SavingsUpdate, SavingsResponse

router = APIRouter(prefix="/savings", tags=["savings"])

@router.get("/my-balance")
def get_my_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's savings balance"""
    savings = db.query(Savings).filter(Savings.user_id == current_user.id).first()
    
    if not savings:
        return {"balance": 0.0}
    
    return {"balance": savings.balance}

@router.get("/", response_model=List[SavingsResponse])
def get_all_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all savings records (Admin, CEO, Manager only)"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    savings = db.query(Savings).all()
    return savings

@router.get("/user/{user_id}")
def get_user_savings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific user's savings"""
    # Customers can only view their own
    if current_user.role == "customer" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    savings = db.query(Savings).filter(Savings.user_id == user_id).first()
    
    if not savings:
        return {"user_id": user_id, "balance": 0.0}
    
    return {"user_id": user_id, "balance": savings.balance}

@router.post("/deposit")
def deposit_savings(
    data: SavingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add to a user's savings (Admin, Manager, Officer only)"""
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    savings = db.query(Savings).filter(Savings.user_id == data.user_id).first()
    
    if savings:
        savings.balance += data.amount
    else:
        savings = Savings(user_id=data.user_id, balance=data.amount)
        db.add(savings)
    
    db.commit()
    db.refresh(savings)
    
    return {"message": "Deposit successful", "new_balance": savings.balance}

@router.post("/withdraw")
def withdraw_savings(
    data: SavingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Withdraw from a user's savings (Admin, Manager, Officer only)"""
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    savings = db.query(Savings).filter(Savings.user_id == data.user_id).first()
    
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
    """Get total savings summary (Admin, CEO, Manager only)"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    from sqlalchemy import func
    
    total = db.query(func.sum(Savings.balance)).scalar() or 0
    count = db.query(func.count(Savings.id)).scalar() or 0
    
    return {
        "total_savings": total,
        "accounts_count": count
    }