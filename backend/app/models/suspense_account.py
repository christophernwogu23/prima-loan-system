from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SuspensePayment(Base):
    __tablename__ = "suspense_payments"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String(50), nullable=False)
    reference_number = Column(String(100), nullable=True)
    payer_info = Column(String(500), nullable=True)  # Any info about who paid
    notes = Column(String(500), nullable=True)
    
    # Matching info
    matched = Column(Boolean, default=False)
    matched_customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    matched_loan_id = Column(Integer, ForeignKey("loan_applications.id"), nullable=True)
    matched_date = Column(DateTime, nullable=True)
    matched_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Reversal info
    reversed = Column(Boolean, default=False)
    reversal_date = Column(DateTime, nullable=True)
    reversal_reason = Column(String(500), nullable=True)
    reversed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    recorder = relationship("User", foreign_keys=[recorded_by])
    matched_customer = relationship("User", foreign_keys=[matched_customer_id])
    matcher = relationship("User", foreign_keys=[matched_by])
    reverser = relationship("User", foreign_keys=[reversed_by])