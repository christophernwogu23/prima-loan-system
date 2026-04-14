from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.fixed_deposit import FixedDeposit
from app.models.fixed_deposit_transaction import FixedDepositTransaction
from app.schemas.fixed_deposit import FixedDepositCreate, FixedDepositUpdate, FixedDepositResponse

router = APIRouter(prefix="/fixed-deposits", tags=["fixed-deposits"])


class FDTransactionCreate(BaseModel):
    transaction_type: str  # 'deposit' or 'liquidation'
    amount: float
    transaction_date: Optional[str] = None  # "2025-01-15"
    notes: Optional[str] = None


# ===== EXISTING ENDPOINTS =====

@router.get("/", response_model=List[FixedDepositResponse])
def get_fixed_deposits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(FixedDeposit).order_by(FixedDeposit.maturity_date.asc()).all()


@router.post("/", response_model=FixedDepositResponse)
def create_fixed_deposit(
    deposit: FixedDepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

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

    # Auto-record the initial deposit transaction
    txn = FixedDepositTransaction(
        fixed_deposit_id=db_deposit.id,
        transaction_type="deposit",
        amount=deposit.amount,
        transaction_date=deposit.value_date or datetime.utcnow(),
        notes="Initial deposit",
        recorded_by=current_user.id
    )
    db.add(txn)
    db.commit()

    return db_deposit


@router.put("/{deposit_id}", response_model=FixedDepositResponse)
def update_fixed_deposit(
    deposit_id: int,
    deposit: FixedDepositUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    db_deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not db_deposit:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")

    for key, value in deposit.dict(exclude_unset=True).items():
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    db_deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not db_deposit:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")

    # Delete transactions first
    db.query(FixedDepositTransaction).filter(
        FixedDepositTransaction.fixed_deposit_id == deposit_id
    ).delete()

    db.delete(db_deposit)
    db.commit()
    return {"message": "Fixed deposit deleted"}


@router.get("/summary")
def get_fixed_deposits_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    total_amount = db.query(func.sum(FixedDeposit.amount)).filter(FixedDeposit.status == "active").scalar() or 0
    total_interest = db.query(func.sum(FixedDeposit.interest_amount)).filter(FixedDeposit.status == "active").scalar() or 0
    active_count = db.query(func.count(FixedDeposit.id)).filter(FixedDeposit.status == "active").scalar() or 0
    thirty_days = datetime.utcnow() + timedelta(days=30)
    maturing_soon = db.query(func.count(FixedDeposit.id)).filter(
        FixedDeposit.status == "active",
        FixedDeposit.maturity_date <= thirty_days
    ).scalar() or 0

    total_liquidated = db.query(func.sum(FixedDepositTransaction.amount)).filter(
        FixedDepositTransaction.transaction_type == "liquidation"
    ).scalar() or 0

    return {
        "total_amount": total_amount,
        "total_interest": total_interest,
        "active_count": active_count,
        "maturing_soon": maturing_soon,
        "total_liquidated": total_liquidated
    }


# ===== TRANSACTION ENDPOINTS =====

@router.post("/{deposit_id}/transactions")
def record_fd_transaction(
    deposit_id: int,
    data: FDTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record a deposit top-up or liquidation for a fixed deposit"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.transaction_type not in ["deposit", "liquidation"]:
        raise HTTPException(status_code=400, detail="transaction_type must be 'deposit' or 'liquidation'")

    fd = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not fd:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Parse date
    if data.transaction_date:
        try:
            txn_date = datetime.strptime(data.transaction_date, "%Y-%m-%d")
        except ValueError:
            txn_date = datetime.utcnow()
    else:
        txn_date = datetime.utcnow()

    txn = FixedDepositTransaction(
        fixed_deposit_id=deposit_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        transaction_date=txn_date,
        notes=data.notes,
        recorded_by=current_user.id
    )
    db.add(txn)

    # If liquidation, update FD status to withdrawn
    if data.transaction_type == "liquidation":
        fd.status = "withdrawn"

    db.commit()
    db.refresh(txn)

    return {
        "message": f"{'Deposit' if data.transaction_type == 'deposit' else 'Liquidation'} recorded successfully",
        "transaction_id": txn.id,
        "new_status": fd.status
    }


@router.get("/{deposit_id}/transactions")
def get_fd_transactions(
    deposit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transactions for a specific fixed deposit"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    fd = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not fd:
        raise HTTPException(status_code=404, detail="Fixed deposit not found")

    transactions = db.query(FixedDepositTransaction).filter(
        FixedDepositTransaction.fixed_deposit_id == deposit_id
    ).order_by(FixedDepositTransaction.transaction_date.desc()).all()

    result = []
    for txn in transactions:
        recorder = db.query(User).filter(User.id == txn.recorded_by).first()
        result.append({
            "id": txn.id,
            "transaction_type": txn.transaction_type,
            "amount": txn.amount,
            "transaction_date": txn.transaction_date,
            "notes": txn.notes,
            "recorded_by_name": f"{recorder.first_name} {recorder.last_name}" if recorder else "Unknown",
            "created_at": txn.created_at
        })

    total_deposited = sum(t["amount"] for t in result if t["transaction_type"] == "deposit")
    total_liquidated = sum(t["amount"] for t in result if t["transaction_type"] == "liquidation")

    return {
        "fixed_deposit": {
            "id": fd.id,
            "depositor_name": fd.depositor_name,
            "amount": fd.amount,
            "interest_amount": fd.interest_amount,
            "status": fd.status
        },
        "transactions": result,
        "total_deposited": total_deposited,
        "total_liquidated": total_liquidated
    }