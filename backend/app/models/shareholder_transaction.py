from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ShareholderTransaction(Base):
    __tablename__ = "shareholder_transactions"

    id = Column(Integer, primary_key=True, index=True)
    shareholder_id = Column(Integer, ForeignKey("shareholders.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # 'injection' or 'drawing'
    amount = Column(Float, nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    shareholder = relationship("Shareholder", foreign_keys=[shareholder_id])
    recorder = relationship("User", foreign_keys=[recorded_by])