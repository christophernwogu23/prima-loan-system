from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.gl_account import GLAccount
from app.models.journal_entry import JournalEntry

router = APIRouter(prefix="/gl", tags=["General Ledger"])

# ===== SCHEMAS =====

class GLAccountCreate(BaseModel):
    account_code: str
    account_name: str
    account_type: str  # asset, liability, equity, income, expense
    description: Optional[str] = None

class GLAccountResponse(BaseModel):
    id: int
    account_code: str
    account_name: str
    account_type: str
    description: Optional[str]
    current_balance: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class JournalEntryCreate(BaseModel):
    entry_date: Optional[datetime] = None
    debit_account_id: int
    credit_account_id: int
    amount: float
    description: str
    reference: Optional[str] = None

class JournalEntryResponse(BaseModel):
    id: int
    entry_number: str
    entry_date: datetime
    debit_account_id: int
    credit_account_id: int
    amount: float
    description: str
    reference: Optional[str]
    is_auto_generated: bool
    created_by: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# ===== GL ACCOUNTS ENDPOINTS =====

@router.get("/accounts", response_model=List[GLAccountResponse])
async def get_gl_accounts(
    account_type: Optional[str] = Query(None),
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all GL accounts"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(GLAccount)
    
    if active_only:
        query = query.filter(GLAccount.is_active == True)
    
    if account_type:
        query = query.filter(GLAccount.account_type == account_type)
    
    accounts = query.order_by(GLAccount.account_code).all()
    
    return accounts

@router.post("/accounts", response_model=GLAccountResponse)
async def create_gl_account(
    account: GLAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new GL account"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create GL accounts")
    
    # Check if account code exists
    existing = db.query(GLAccount).filter(GLAccount.account_code == account.account_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account code already exists")
    
    # Validate account type
    valid_types = ["asset", "liability", "equity", "income", "expense"]
    if account.account_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid account type. Must be: {valid_types}")
    
    gl_account = GLAccount(
        account_code=account.account_code,
        account_name=account.account_name,
        account_type=account.account_type,
        description=account.description,
        current_balance=0.0
    )
    
    db.add(gl_account)
    db.commit()
    db.refresh(gl_account)
    
    return gl_account

@router.get("/accounts/{account_id}/transactions")
async def get_account_transactions(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all transactions for a specific GL account"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    account = db.query(GLAccount).filter(GLAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="GL account not found")
    
    # Get all entries where this account is debited or credited
    debit_entries = db.query(JournalEntry).filter(
        JournalEntry.debit_account_id == account_id
    ).all()
    
    credit_entries = db.query(JournalEntry).filter(
        JournalEntry.credit_account_id == account_id
    ).all()
    
    # Combine and format
    transactions = []
    
    for entry in debit_entries:
        transactions.append({
            "id": entry.id,
            "entry_number": entry.entry_number,
            "date": entry.entry_date,
            "description": entry.description,
            "reference": entry.reference,
            "debit": entry.amount,
            "credit": 0,
            "type": "debit"
        })
    
    for entry in credit_entries:
        transactions.append({
            "id": entry.id,
            "entry_number": entry.entry_number,
            "date": entry.entry_date,
            "description": entry.description,
            "reference": entry.reference,
            "debit": 0,
            "credit": entry.amount,
            "type": "credit"
        })
    
    # Sort by date
    transactions.sort(key=lambda x: x["date"], reverse=True)
    
    return {
        "account": account,
        "transactions": transactions,
        "current_balance": account.current_balance
    }

# ===== JOURNAL ENTRIES ENDPOINTS =====

@router.post("/entries", response_model=JournalEntryResponse)
async def create_journal_entry(
    entry: JournalEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new journal entry (manual)"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admin and manager can create journal entries")
    
    # Validate accounts exist
    debit_account = db.query(GLAccount).filter(GLAccount.id == entry.debit_account_id).first()
    credit_account = db.query(GLAccount).filter(GLAccount.id == entry.credit_account_id).first()
    
    if not debit_account or not credit_account:
        raise HTTPException(status_code=404, detail="Debit or credit account not found")
    
    # Can't debit and credit the same account
    if entry.debit_account_id == entry.credit_account_id:
        raise HTTPException(status_code=400, detail="Cannot debit and credit the same account")
    
    # Generate entry number
    entry_number = f"JE-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(JournalEntry.id)).scalar() + 1:04d}"
    
    # Create journal entry
    journal_entry = JournalEntry(
        entry_number=entry_number,
        entry_date=entry.entry_date or datetime.utcnow(),
        debit_account_id=entry.debit_account_id,
        credit_account_id=entry.credit_account_id,
        amount=entry.amount,
        description=entry.description,
        reference=entry.reference,
        is_auto_generated=False,
        created_by=current_user.id
    )
    
    db.add(journal_entry)
    
    # Update account balances
    # Debit increases: Assets, Expenses
    # Debit decreases: Liabilities, Equity, Income
    if debit_account.account_type in ["asset", "expense"]:
        debit_account.current_balance += entry.amount
    else:
        debit_account.current_balance -= entry.amount
    
    # Credit increases: Liabilities, Equity, Income
    # Credit decreases: Assets, Expenses
    if credit_account.account_type in ["liability", "equity", "income"]:
        credit_account.current_balance += entry.amount
    else:
        credit_account.current_balance -= entry.amount
    
    db.commit()
    db.refresh(journal_entry)
    
    return journal_entry

@router.get("/entries", response_model=List[JournalEntryResponse])
async def get_journal_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all journal entries"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = db.query(JournalEntry)
    
    # Filter by date range
    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    
    # Filter by account
    if account_id:
        query = query.filter(
            or_(
                JournalEntry.debit_account_id == account_id,
                JournalEntry.credit_account_id == account_id
            )
        )
    
    entries = query.order_by(JournalEntry.entry_date.desc()).all()
    
    return entries

@router.delete("/entries/{entry_id}")
async def delete_journal_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a journal entry and reverse the balance changes"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete journal entries")
    
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    # Can't delete auto-generated entries
    if entry.is_auto_generated:
        raise HTTPException(status_code=400, detail="Cannot delete auto-generated journal entries")
    
    # Reverse the balance changes
    debit_account = db.query(GLAccount).filter(GLAccount.id == entry.debit_account_id).first()
    credit_account = db.query(GLAccount).filter(GLAccount.id == entry.credit_account_id).first()
    
    # Reverse debit
    if debit_account.account_type in ["asset", "expense"]:
        debit_account.current_balance -= entry.amount
    else:
        debit_account.current_balance += entry.amount
    
    # Reverse credit
    if credit_account.account_type in ["liability", "equity", "income"]:
        credit_account.current_balance -= entry.amount
    else:
        credit_account.current_balance += entry.amount
    
    db.delete(entry)
    db.commit()
    
    return {"message": "Journal entry deleted and balances reversed"}

# ===== HELPER FUNCTION FOR AUTO-INTEGRATION =====

def auto_create_journal_entry(
    db: Session,
    debit_account_code: str,
    credit_account_code: str,
    amount: float,
    description: str,
    reference: str,
    created_by_id: int
):
    """
    Helper function to auto-create journal entries
    Used by other modules (loans, payments, etc.)
    """
    # Get accounts by code
    debit_account = db.query(GLAccount).filter(GLAccount.account_code == debit_account_code).first()
    credit_account = db.query(GLAccount).filter(GLAccount.account_code == credit_account_code).first()
    
    if not debit_account or not credit_account:
        print(f"Warning: GL accounts not found: {debit_account_code} or {credit_account_code}")
        return None
    
    # Generate entry number
    entry_number = f"JE-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(JournalEntry.id)).scalar() + 1:04d}"
    
    # Create entry
    journal_entry = JournalEntry(
        entry_number=entry_number,
        entry_date=datetime.utcnow(),
        debit_account_id=debit_account.id,
        credit_account_id=credit_account.id,
        amount=amount,
        description=description,
        reference=reference,
        is_auto_generated=True,
        created_by=created_by_id
    )
    
    db.add(journal_entry)
    
    # Update balances
    if debit_account.account_type in ["asset", "expense"]:
        debit_account.current_balance += amount
    else:
        debit_account.current_balance -= amount
    
    if credit_account.account_type in ["liability", "equity", "income"]:
        credit_account.current_balance += amount
    else:
        credit_account.current_balance -= amount
    
    return journal_entry