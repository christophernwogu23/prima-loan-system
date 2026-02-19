from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.transit_account import TransitDeposit

router = APIRouter(prefix="/transit", tags=["Transit Account"])

class TransitDepositCreate(BaseModel):
    amount: float
    collector_name: str
    collection_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class TransitDepositResponse(BaseModel):
    id: int
    amount: float
    collector_name: str
    collection_date: datetime
    deposited_to_bank: bool
    bank_deposit_date: Optional[datetime]
    reference_number: Optional[str]
    notes: Optional[str]
    recorded_by: int
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/", response_model=TransitDepositResponse)
async def create_transit_deposit(
    deposit: TransitDepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record a new transit deposit"""
    
    # Only staff can record transit deposits
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    transit_deposit = TransitDeposit(
        amount=deposit.amount,
        collector_name=deposit.collector_name,
        collection_date=deposit.collection_date or datetime.utcnow(),
        reference_number=deposit.reference_number,
        notes=deposit.notes,
        recorded_by=current_user.id
    )
    
    db.add(transit_deposit)
    db.commit()
    db.refresh(transit_deposit)
    
    return transit_deposit

@router.get("/", response_model=List[TransitDepositResponse])
async def get_transit_deposits(
    show_deposited: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transit deposits"""
    
    if current_user.role not in ["admin", "manager", "ceo", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(TransitDeposit)
    
    # Filter by deposited status
    if not show_deposited:
        query = query.filter(TransitDeposit.deposited_to_bank == False)
    
    deposits = query.order_by(TransitDeposit.collection_date.desc()).all()
    
    return deposits

@router.post("/{deposit_id}/deposit-to-bank")
async def deposit_to_bank(
    deposit_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark transit deposit as deposited to bank"""
    
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admin and manager can deposit to bank")
    
    deposit = db.query(TransitDeposit).filter(TransitDeposit.id == deposit_id).first()
    
    if not deposit:
        raise HTTPException(status_code=404, detail="Transit deposit not found")
    
    if deposit.deposited_to_bank:
        raise HTTPException(status_code=400, detail="Already deposited to bank")
    
    deposit.deposited_to_bank = True
    deposit.bank_deposit_date = datetime.utcnow()
    deposit.reference_number = data.get("reference_number", deposit.reference_number)
    
    db.commit()
    
    return {"message": "Deposited to bank successfully"}

@router.get("/stats")
async def get_transit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get transit account statistics"""
    
    if current_user.role not in ["admin", "manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Pending deposits (not yet banked)
    pending = db.query(TransitDeposit).filter(
        TransitDeposit.deposited_to_bank == False
    ).all()
    
    pending_balance = sum(d.amount for d in pending)
    pending_count = len(pending)
    
    # Total all time
    total_count = db.query(func.count(TransitDeposit.id)).scalar() or 0
    total_amount = db.query(func.sum(TransitDeposit.amount)).scalar() or 0
    
    return {
        "pending_balance": pending_balance,
        "pending_count": pending_count,
        "total_count": total_count,
        "total_amount": total_amount
    }

@router.delete("/{deposit_id}")
async def delete_transit_deposit(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a transit deposit"""
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete transit deposits")
    
    deposit = db.query(TransitDeposit).filter(TransitDeposit.id == deposit_id).first()
    
    if not deposit:
        raise HTTPException(status_code=404, detail="Transit deposit not found")
    
    if deposit.deposited_to_bank:
        raise HTTPException(status_code=400, detail="Cannot delete deposit that's already banked")
    
    db.delete(deposit)
    db.commit()
    
    return {"message": "Transit deposit deleted successfully"}