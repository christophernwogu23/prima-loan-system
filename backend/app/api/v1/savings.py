import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.savings import Savings
from app.models.savings_transaction import SavingsTransaction
from app.schemas.savings import SavingsUpdate, SavingsResponse

router = APIRouter(prefix="/savings", tags=["savings"])


class TransactionRequest(BaseModel):
    user_id: Optional[int] = None
    amount: float
    note: Optional[str] = None
    transaction_date: Optional[datetime] = None  # allows back-dating; defaults to now


class TransferRequest(BaseModel):
    from_user_id: int
    to_user_id: int
    amount: float
    note: Optional[str] = None
    transaction_date: Optional[datetime] = None


def _recompute_balances(db: Session, user_id: int) -> float:
    """
    Recalculates balance_after for every transaction belonging to a user, in
    chronological order of transaction_date (not insert order). This keeps
    history correct even when a transaction is back-dated in after the fact.
    Returns the resulting live balance.
    """
    txns = (
        db.query(SavingsTransaction)
        .filter(SavingsTransaction.user_id == user_id)
        .order_by(SavingsTransaction.transaction_date, SavingsTransaction.id)
        .all()
    )
    running = 0.0
    for t in txns:
        if t.type in ("deposit", "transfer_in"):
            running += t.amount
        else:
            running -= t.amount
        t.balance_after = running
    db.flush()

    savings = db.query(Savings).filter(Savings.user_id == user_id).first()
    if savings:
        savings.balance = running
    else:
        savings = Savings(user_id=user_id, balance=running)
        db.add(savings)
    db.flush()
    return running


def _resolve_target_user(current_user: User, requested_user_id: Optional[int]) -> int:
    if current_user.role == "customer":
        return current_user.id
    if current_user.role in ["admin", "manager", "loan_officer"]:
        if not requested_user_id:
            raise HTTPException(status_code=400, detail="user_id is required for staff")
        return requested_user_id
    raise HTTPException(status_code=403, detail="Access denied")


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
    return db.query(Savings).all()


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


@router.get("/transactions/my")
def get_my_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Customer views their own transaction history"""
    txns = db.query(SavingsTransaction).filter(
        SavingsTransaction.user_id == current_user.id
    ).order_by(SavingsTransaction.transaction_date.desc(), SavingsTransaction.id.desc()).all()
    return _format_transactions(txns, db)


@router.get("/transactions/{user_id}")
def get_user_transactions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Staff views a specific customer's transaction history"""
    if current_user.role not in ["admin", "ceo", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")
    txns = db.query(SavingsTransaction).filter(
        SavingsTransaction.user_id == user_id
    ).order_by(SavingsTransaction.transaction_date.desc(), SavingsTransaction.id.desc()).all()
    return _format_transactions(txns, db)


def _format_transactions(txns, db: Session):
    result = []
    for t in txns:
        posted_by = db.query(User).filter(User.id == t.created_by_id).first() if t.created_by_id else None
        result.append({
            "id": t.id,
            "type": t.type,
            "amount": t.amount,
            "balance_after": t.balance_after,
            "note": t.note,
            "reference": t.reference,
            "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "posted_by": f"{posted_by.first_name} {posted_by.last_name}" if posted_by else "System"
        })
    return result


@router.post("/deposit")
def deposit_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_user_id = _resolve_target_user(current_user, data.user_id)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    txn = SavingsTransaction(
        user_id=target_user_id,
        type="deposit",
        amount=data.amount,
        balance_after=0.0,  # placeholder, corrected by recompute below
        note=data.note,
        transaction_date=data.transaction_date or datetime.utcnow(),
        created_by_id=current_user.id
    )
    db.add(txn)
    db.flush()

    new_balance = _recompute_balances(db, target_user_id)
    db.commit()
    return {"message": "Deposit successful", "new_balance": new_balance}


@router.post("/withdraw")
def withdraw_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_user_id = _resolve_target_user(current_user, data.user_id)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    savings = db.query(Savings).filter(Savings.user_id == target_user_id).first()
    if not savings or savings.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    txn = SavingsTransaction(
        user_id=target_user_id,
        type="withdraw",
        amount=data.amount,
        balance_after=0.0,
        note=data.note,
        transaction_date=data.transaction_date or datetime.utcnow(),
        created_by_id=current_user.id
    )
    db.add(txn)
    db.flush()

    new_balance = _recompute_balances(db, target_user_id)
    db.commit()
    return {"message": "Withdrawal successful", "new_balance": new_balance}


@router.post("/transfer")
def transfer_savings(
    data: TransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move funds from one customer's savings account to another."""
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.from_user_id == data.to_user_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    source = db.query(Savings).filter(Savings.user_id == data.from_user_id).first()
    if not source or source.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance in source account")

    destination = db.query(User).filter(User.id == data.to_user_id).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination customer not found")

    txn_date = data.transaction_date or datetime.utcnow()
    ref = str(uuid.uuid4())
    note = data.note or f"Transfer between customers"

    out_txn = SavingsTransaction(
        user_id=data.from_user_id,
        type="transfer_out",
        amount=data.amount,
        balance_after=0.0,
        note=note,
        transaction_date=txn_date,
        reference=ref,
        created_by_id=current_user.id
    )
    in_txn = SavingsTransaction(
        user_id=data.to_user_id,
        type="transfer_in",
        amount=data.amount,
        balance_after=0.0,
        note=note,
        transaction_date=txn_date,
        reference=ref,
        created_by_id=current_user.id
    )
    db.add(out_txn)
    db.add(in_txn)
    db.flush()

    source_balance = _recompute_balances(db, data.from_user_id)
    dest_balance = _recompute_balances(db, data.to_user_id)
    db.commit()

    return {
        "message": "Transfer successful",
        "reference": ref,
        "source_balance": source_balance,
        "destination_balance": dest_balance
    }


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