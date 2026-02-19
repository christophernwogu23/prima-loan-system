from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class TransitDeposit(Base):
    __tablename__ = "transit_deposits"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    collector_name = Column(String(200), nullable=False)
    collection_date = Column(DateTime, default=datetime.utcnow)
    deposited_to_bank = Column(Boolean, default=False)
    bank_deposit_date = Column(DateTime, nullable=True)
    reference_number = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    recorder = relationship("User", foreign_keys=[recorded_by])