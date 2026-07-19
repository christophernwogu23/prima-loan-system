from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class SavingsTransaction(Base):
    __tablename__ = "savings_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(20), nullable=False)   # "deposit", "withdraw", "transfer_in", "transfer_out"
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    note = Column(Text, nullable=True)

    # The effective date of the transaction (can be back-dated). Separate from created_at,
    # which is always the real audit timestamp of when the record was entered into the system.
    transaction_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Links the two legs of a transfer together (same value on both rows). Null for plain deposits/withdrawals.
    reference = Column(String(36), nullable=True, index=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])