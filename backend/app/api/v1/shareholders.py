from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.shareholder import Shareholder
from app.models.user import User

router = APIRouter(prefix="/shareholders", tags=["shareholders"])

class ShareholderCreate(BaseModel):
    name: str
    capital: float
    notes: Optional[str] = None  # Changed from str = None

class ShareholderUpdate(BaseModel):
    name: Optional[str] = None  # Changed from str = None
    capital: Optional[float] = None  # Changed from float = None
    notes: Optional[str] = None  # Changed from str = None

class ShareholderResponse(BaseModel):
    id: int
    name: str
    capital: float
    notes: Optional[str] = None  # Changed from str = None
    created_at: Optional[datetime] = None  # Changed from datetime = None

    class Config:
        from_attributes = True

@router.get("", response_model=List[ShareholderResponse])
async def get_shareholders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all shareholders"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    shareholders = db.query(Shareholder).order_by(Shareholder.capital.desc()).all()
    return shareholders

@router.get("/summary")
async def get_shareholders_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get shareholders summary"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    total_capital = db.query(func.sum(Shareholder.capital)).scalar() or 0
    count = db.query(func.count(Shareholder.id)).scalar() or 0
    
    return {
        "total_capital": total_capital,
        "shareholder_count": count
    }

@router.post("", response_model=ShareholderResponse)
async def create_shareholder(
    data: ShareholderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new shareholder"""
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    new_shareholder = Shareholder(
        name=data.name,
        capital=data.capital,
        notes=data.notes
    )
    db.add(new_shareholder)
    db.commit()
    db.refresh(new_shareholder)
    return new_shareholder

@router.put("/{shareholder_id}", response_model=ShareholderResponse)
async def update_shareholder(
    shareholder_id: int,
    data: ShareholderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a shareholder"""
    if current_user.role not in ["admin", "ceo"]:
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
    """Delete a shareholder"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    shareholder = db.query(Shareholder).filter(Shareholder.id == shareholder_id).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")
    
    db.delete(shareholder)
    db.commit()
    return {"message": "Shareholder deleted"}