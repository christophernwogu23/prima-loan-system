from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class FixedDepositTransaction(Base):
    __tablename__ = "fixed_deposit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    fixed_deposit_id = Column(Integer, ForeignKey("fixed_deposits.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # 'deposit' or 'liquidation'
    amount = Column(Float, nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    fixed_deposit = relationship("FixedDeposit", foreign_keys=[fixed_deposit_id])
    recorder = relationship("User", foreign_keys=[recorded_by])