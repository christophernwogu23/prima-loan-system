from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class GLAccount(Base):
    """General Ledger Account - represents a financial account"""
    __tablename__ = "gl_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_code = Column(String(20), unique=True, nullable=False, index=True)  # e.g., "1001", "2001"
    account_name = Column(String(200), nullable=False)  # e.g., "Bank Account", "Vehicles"
    account_type = Column(String(50), nullable=False)  # asset, liability, equity, income, expense
    description = Column(String(500), nullable=True)
    current_balance = Column(Float, default=0.0)  # Running balance
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to journal entries
    debit_entries = relationship("JournalEntry", foreign_keys="JournalEntry.debit_account_id", back_populates="debit_account")
    credit_entries = relationship("JournalEntry", foreign_keys="JournalEntry.credit_account_id", back_populates="credit_account")