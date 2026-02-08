from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.fixed_deposit import FixedDeposit
from app.schemas.fixed_deposit import FixedDepositCreate, FixedDepositUpdate, FixedDepositResponse

router = APIRouter(prefix="/fixed-deposits", tags=["fixed-deposits"])

@router.get("/", response_model=List[FixedDepositResponse])
def get_fixed_deposits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all fixed deposits (Admin, CEO only)"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    deposits = db.query(FixedDeposit).order_by(FixedDeposit.maturity_date.asc()).all()
    return deposits

@router.post("/", response_model=FixedDepositResponse)
def create_fixed_deposit(
    deposit: FixedDepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new fixed deposit (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db_deposit = FixedDeposit(
        depositor_name=deposit.depositor_name,
        amount=deposit.amount,
        interest_amount=deposit.interest_amount,
        value_date=deposit.value_date,
        maturity_date=deposit.maturity_date,
        duration=deposit.duration,
        notes=deposit.notes,
        status="active"
    )
    
    db.add(db_deposit)
    db.commit()
    db.refresh(db_deposit)
    
    return db_deposit

@router.put("/{deposit_id}", response_model=FixedDepositResponse)
def update_fixed_deposit(
    deposit_id: int,
    deposit: FixedDepositUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a fixed deposit (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db_deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    
    if not db_deposit:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")
    
    update_data = deposit.dict(exclude_unset=True)
    
    
    for key, value in update_data.items():
        setattr(db_deposit, key, value)
    
    db.commit()
    db.refresh(db_deposit)
    
    return db_deposit

@router.delete("/{deposit_id}")
def delete_fixed_deposit(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a fixed deposit (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db_deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    
    if not db_deposit:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")
    
    db.delete(db_deposit)
    db.commit()
    
    return {"message": "Fixed deposit deleted"}

@router.get("/summary")
def get_fixed_deposits_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get fixed deposits summary (Admin, CEO only)"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Total active deposits
    total_amount = db.query(func.sum(FixedDeposit.amount)).filter(
        FixedDeposit.status == "active"
    ).scalar() or 0
    
    total_interest = db.query(func.sum(FixedDeposit.interest_amount)).filter(
        FixedDeposit.status == "active"
    ).scalar() or 0
    
    active_count = db.query(func.count(FixedDeposit.id)).filter(
        FixedDeposit.status == "active"
    ).scalar() or 0
    
    # Maturing soon (within 30 days)
    from datetime import timedelta
    thirty_days = datetime.utcnow() + timedelta(days=30)
    maturing_soon = db.query(func.count(FixedDeposit.id)).filter(
        FixedDeposit.status == "active",
        FixedDeposit.maturity_date <= thirty_days
    ).scalar() or 0
    
    return {
        "total_amount": total_amount,
        "total_interest": total_interest,
        "active_count": active_count,
        "maturing_soon": maturing_soon
    }