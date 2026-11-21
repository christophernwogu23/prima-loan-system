import logging
import math
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.savings import Savings
from app.models.savings_transaction import SavingsTransaction
from app.schemas.savings import SavingsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/savings", tags=["savings"])

POSTING_ROLES = ["admin", "manager", "loan_officer"]
VIEW_ROLES = ["admin", "ceo", "manager", "loan_officer"]
CREDIT_TYPES = ("deposit", "transfer_in")


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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive_utc(dt: Optional[datetime]) -> datetime:
    """MySQL stores naive datetimes. Convert anything timezone-aware to naive UTC
    so dates can always be compared safely."""
    if dt is None:
        return _now()
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _clean_amount(value: float) -> float:
    if value is None or not math.isfinite(value):
        raise HTTPException(status_code=400, detail="Amount is not valid")
    amount = round(value, 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    return amount


def _full_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _require_user(db: Session, user_id: int, label: str = "Customer") -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return user


@contextmanager
def _atomic(db: Session):
    """Everything inside the block is saved together, or not at all."""
    try:
        yield
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Savings posting failed")
        raise HTTPException(
            status_code=500,
            detail="Could not save the transaction. Please check the server log.",
        )


def _lock_savings(db: Session, user_id: int) -> Savings:
    """Get the customer's savings row and lock it until the transaction ends, so two
    postings at the same moment cannot overdraw the account. If the customer has no
    savings account yet (new customer, or one that existed before the migration),
    one is created."""
    savings = (
        db.query(Savings)
        .filter(Savings.user_id == user_id)
        .with_for_update()
        .first()
    )
    if savings is None:
        savings = Savings(user_id=user_id, balance=0.0)
        db.add(savings)
        db.flush()
    return savings


def _recompute_balances(db: Session, user_id: int, guard_from: Optional[datetime] = None) -> float:
    """
    Recalculates balance_after for every transaction belonging to a user, in
    chronological order of transaction_date (not insert order). This keeps
    history correct even when a transaction is back-dated in after the fact.

    guard_from: used for withdrawals and transfers out. If the running balance
    goes below zero on or after this date, the posting is rejected. Older history
    is not checked, so imported data cannot block new postings.

    Returns the resulting live balance.
    """
    txns = (
        db.query(SavingsTransaction)
        .filter(SavingsTransaction.user_id == user_id)
        .order_by(SavingsTransaction.transaction_date, SavingsTransaction.id)
        .all()
    )
    guard = _naive_utc(guard_from) if guard_from else None
    running = 0.0
    for t in txns:
        if t.type in CREDIT_TYPES:
            running = round(running + t.amount, 2)
        else:
            running = round(running - t.amount, 2)
        t.balance_after = running
        if guard and running < 0 and _naive_utc(t.transaction_date) >= guard:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance: this would take the account below zero on {t.transaction_date:%d %b %Y}",
            )
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
    if current_user.role in POSTING_ROLES:
        if not requested_user_id:
            raise HTTPException(status_code=400, detail="user_id is required for staff")
        return requested_user_id
    raise HTTPException(status_code=403, detail="Access denied")


def _format_transactions(txns, db: Session):
    creator_ids = {t.created_by_id for t in txns if t.created_by_id}
    creators = (
        {u.id: u for u in db.query(User).filter(User.id.in_(creator_ids)).all()}
        if creator_ids
        else {}
    )
    result = []
    for t in txns:
        posted_by = creators.get(t.created_by_id)
        result.append({
            "id": t.id,
            "type": t.type,
            "amount": t.amount,
            "balance_after": t.balance_after,
            "note": t.note,
            "reference": t.reference,
            "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "posted_by": _full_name(posted_by) if posted_by else "System",
        })
    return result


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

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
    if current_user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Savings).all()


@router.get("/customers")
def list_customers_with_savings(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Every active customer, with their savings balance (0 if they have no savings
    account yet). Use this to fill the customer pickers for deposit, withdrawal and
    transfer, so customers without a savings account can still be selected.
    """
    if current_user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")

    query = (
        db.query(User, Savings.balance)
        .outerjoin(Savings, Savings.user_id == User.id)
        .filter(User.role == "customer", User.status == "active")
    )
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
            )
        )
    rows = query.order_by(User.first_name, User.last_name).limit(200).all()
    return [
        {
            "user_id": u.id,
            "name": _full_name(u),
            "email": u.email,
            "balance": balance or 0.0,
            "has_savings_account": balance is not None,
        }
        for u, balance in rows
    ]


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
    if current_user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    txns = db.query(SavingsTransaction).filter(
        SavingsTransaction.user_id == user_id
    ).order_by(SavingsTransaction.transaction_date.desc(), SavingsTransaction.id.desc()).all()
    return _format_transactions(txns, db)


# ---------------------------------------------------------------------------
# Posting endpoints
# ---------------------------------------------------------------------------

@router.post("/deposit")
def deposit_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_user_id = _resolve_target_user(current_user, data.user_id)
    amount = _clean_amount(data.amount)
    _require_user(db, target_user_id)

    with _atomic(db):
        _lock_savings(db, target_user_id)  # creates the savings account if missing
        db.add(SavingsTransaction(
            user_id=target_user_id,
            type="deposit",
            amount=amount,
            balance_after=0.0,  # placeholder, corrected by recompute below
            note=data.note,
            transaction_date=_naive_utc(data.transaction_date),
            created_by_id=current_user.id,
        ))
        db.flush()
        new_balance = _recompute_balances(db, target_user_id)

    return {"message": "Deposit successful", "new_balance": new_balance}


@router.post("/withdraw")
def withdraw_savings(
    data: TransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_user_id = _resolve_target_user(current_user, data.user_id)
    amount = _clean_amount(data.amount)
    _require_user(db, target_user_id)
    txn_date = _naive_utc(data.transaction_date)

    with _atomic(db):
        savings = _lock_savings(db, target_user_id)
        if round(savings.balance or 0.0, 2) < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        db.add(SavingsTransaction(
            user_id=target_user_id,
            type="withdraw",
            amount=amount,
            balance_after=0.0,
            note=data.note,
            transaction_date=txn_date,
            created_by_id=current_user.id,
        ))
        db.flush()
        new_balance = _recompute_balances(db, target_user_id, guard_from=txn_date)

    return {"message": "Withdrawal successful", "new_balance": new_balance}


@router.post("/transfer")
def transfer_savings(
    data: TransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move funds from one customer's savings account to another."""
    if current_user.role not in POSTING_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.from_user_id == data.to_user_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    amount = _clean_amount(data.amount)
    source_user = _require_user(db, data.from_user_id, "Source customer")
    dest_user = _require_user(db, data.to_user_id, "Destination customer")

    txn_date = _naive_utc(data.transaction_date)
    ref = str(uuid.uuid4())

    out_note = f"Transfer to {_full_name(dest_user)}"
    in_note = f"Transfer from {_full_name(source_user)}"
    if data.note:
        out_note = f"{out_note} - {data.note}"
        in_note = f"{in_note} - {data.note}"

    with _atomic(db):
        # Lock both accounts, lowest id first, so two transfers can never deadlock.
        # The destination account is created automatically if it does not exist.
        locked = {uid: _lock_savings(db, uid) for uid in sorted([data.from_user_id, data.to_user_id])}

        if round(locked[data.from_user_id].balance or 0.0, 2) < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance in source account")

        db.add(SavingsTransaction(
            user_id=data.from_user_id,
            type="transfer_out",
            amount=amount,
            balance_after=0.0,
            note=out_note,
            transaction_date=txn_date,
            reference=ref,
            created_by_id=current_user.id,
        ))
        db.add(SavingsTransaction(
            user_id=data.to_user_id,
            type="transfer_in",
            amount=amount,
            balance_after=0.0,
            note=in_note,
            transaction_date=txn_date,
            reference=ref,
            created_by_id=current_user.id,
        ))
        db.flush()

        source_balance = _recompute_balances(db, data.from_user_id, guard_from=txn_date)
        dest_balance = _recompute_balances(db, data.to_user_id)

    return {
        "message": "Transfer successful",
        "reference": ref,
        "source_balance": source_balance,
        "destination_balance": dest_balance,
    }


# ---------------------------------------------------------------------------
# Summary / admin
# ---------------------------------------------------------------------------

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