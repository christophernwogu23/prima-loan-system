from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base

class FixedDeposit(Base):
    __tablename__ = "fixed_deposits"

    id = Column(Integer, primary_key=True, index=True)
    depositor_name = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    interest_amount = Column(Float, nullable=False)
    value_date = Column(DateTime(timezone=True), nullable=False)
    maturity_date = Column(DateTime(timezone=True), nullable=False)
    duration = Column(String(50))
    status = Column(String(20), default="active")
    notes = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())