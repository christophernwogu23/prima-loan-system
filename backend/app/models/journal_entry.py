from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class JournalEntry(Base):
    """Journal Entry - records a transaction between two GL accounts"""
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "JE-20260221-001"
    entry_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # The two accounts involved
    debit_account_id = Column(Integer, ForeignKey("gl_accounts.id"), nullable=False)  # Account losing money
    credit_account_id = Column(Integer, ForeignKey("gl_accounts.id"), nullable=False)  # Account gaining money
    
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=False)
    reference = Column(String(200), nullable=True)  # Link to loan app, payment, etc.
    
    # Auto vs Manual
    is_auto_generated = Column(Boolean, default=False)  # True if system created, False if manual
    
    # Who created it
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    debit_account = relationship("GLAccount", foreign_keys=[debit_account_id], back_populates="debit_entries")
    credit_account = relationship("GLAccount", foreign_keys=[credit_account_id], back_populates="credit_entries")
    creator = relationship("User", foreign_keys=[created_by])