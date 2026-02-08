from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    expense_date = Column(DateTime(timezone=True), default=func.now())
    recorded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recorder = relationship("User", foreign_keys=[recorded_by])