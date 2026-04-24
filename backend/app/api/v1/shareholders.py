from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.shareholder import Shareholder
from app.models.shareholder_transaction import ShareholderTransaction
from app.models.user import User

router = APIRouter(prefix="/shareholders", tags=["shareholders"])


class ShareholderCreate(BaseModel):
    name: str
    capital: float
    notes: Optional[str] = None

class ShareholderUpdate(BaseModel):
    name: Optional[str] = None
    capital: Optional[float] = None
    notes: Optional[str] = None

class ShareholderResponse(BaseModel):
    id: int
    name: str
    capital: float
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ShareholderTxnCreate(BaseModel):
    transaction_type: str  # 'injection' or 'drawing'
    amount: float
    transaction_date: Optional[str] = None  # "2025-01-15"
    notes: Optional[str] = None


# ===== SHAREHOLDERS CRUD =====

@router.get("", response_model=List[ShareholderResponse])
async def get_shareholders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Shareholder).order_by(Shareholder.capital.desc()).all()


@router.get("/summary")
async def get_shareholders_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    total_capital = db.query(func.sum(Shareholder.capital)).scalar() or 0
    count = db.query(func.count(Shareholder.id)).scalar() or 0
    total_injections = db.query(func.sum(ShareholderTransaction.amount)).filter(
        ShareholderTransaction.transaction_type == "injection"
    ).scalar() or 0
    total_drawings = db.query(func.sum(ShareholderTransaction.amount)).filter(
        ShareholderTransaction.transaction_type == "drawing"
    ).scalar() or 0

    return {
        "total_capital": total_capital,
        "shareholder_count": count,
        "total_injections": total_injections,
        "total_drawings": total_drawings
    }


@router.post("", response_model=ShareholderResponse)
async def create_shareholder(
    data: ShareholderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    shareholder = Shareholder(name=data.name, capital=data.capital, notes=data.notes)
    db.add(shareholder)
    db.commit()
    db.refresh(shareholder)

    # Auto-record initial capital as an injection
    txn = ShareholderTransaction(
        shareholder_id=shareholder.id,
        transaction_type="injection",
        amount=data.capital,
        transaction_date=datetime.utcnow(),
        notes="Initial capital",
        recorded_by=current_user.id
    )
    db.add(txn)
    db.commit()

    return shareholder


@router.put("/{shareholder_id}", response_model=ShareholderResponse)
async def update_shareholder(
    shareholder_id: int,
    data: ShareholderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    shareholder = db.query(Shareholder).filter(Shareholder.id == shareholder_id).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    if data.name is not None:
        shareholder.name = data.name
    if data.capital is not None:
        shareholder.capital = data.capital
    if data.notes is not None:
        shareholder.notes = data.notes

    db.commit()
    db.refresh(shareholder)
    return shareholder


@router.delete("/{shareholder_id}")
async def delete_shareholder(
    shareholder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    shareholder = db.query(Shareholder).filter(Shareholder.id == shareholder_id).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    # Delete transactions first
    db.query(ShareholderTransaction).filter(
        ShareholderTransaction.shareholder_id == shareholder_id
    ).delete()

    db.delete(shareholder)
    db.commit()
    return {"message": "Shareholder deleted"}


# ===== TRANSACTION ENDPOINTS =====

@router.post("/{shareholder_id}/transactions")
async def record_shareholder_transaction(
    shareholder_id: int,
    data: ShareholderTxnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record a capital injection or drawing for a shareholder"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.transaction_type not in ["injection", "drawing"]:
        raise HTTPException(status_code=400, detail="transaction_type must be 'injection' or 'drawing'")

    shareholder = db.query(Shareholder).filter(Shareholder.id == shareholder_id).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    if data.transaction_date:
        try:
            txn_date = datetime.strptime(data.transaction_date, "%Y-%m-%d")
        except ValueError:
            txn_date = datetime.utcnow()
    else:
        txn_date = datetime.utcnow()

    txn = ShareholderTransaction(
        shareholder_id=shareholder_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        transaction_date=txn_date,
        notes=data.notes,
        recorded_by=current_user.id
    )
    db.add(txn)

    # Update capital balance
    if data.transaction_type == "injection":
        shareholder.capital += data.amount
    else:
        if shareholder.capital < data.amount:
            raise HTTPException(status_code=400, detail="Drawing exceeds current capital balance")
        shareholder.capital -= data.amount

    db.commit()
    db.refresh(txn)

    return {
        "message": f"{'Capital injection' if data.transaction_type == 'injection' else 'Drawing'} recorded successfully",
        "transaction_id": txn.id,
        "new_capital": shareholder.capital
    }


@router.get("/{shareholder_id}/transactions")
async def get_shareholder_transactions(
    shareholder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transactions for a specific shareholder"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    shareholder = db.query(Shareholder).filter(Shareholder.id == shareholder_id).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    transactions = db.query(ShareholderTransaction).filter(
        ShareholderTransaction.shareholder_id == shareholder_id
    ).order_by(ShareholderTransaction.transaction_date.desc()).all()

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

    total_injections = sum(t["amount"] for t in result if t["transaction_type"] == "injection")
    total_drawings = sum(t["amount"] for t in result if t["transaction_type"] == "drawing")

    return {
        "shareholder": {
            "id": shareholder.id,
            "name": shareholder.name,
            "capital": shareholder.capital
        },
        "transactions": result,
        "total_injections": total_injections,
        "total_drawings": total_drawings
    }