from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, Float, Text, JSON
from sqlalchemy.sql import func
from app.database import Base
import enum

class InterestType(str, enum.Enum):
    SIMPLE = "simple"
    COMPOUND = "compound"
    REDUCING_BALANCE = "reducing_balance"

class RepaymentFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"

class LoanProduct(Base):
    __tablename__ = "loan_products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    min_amount = Column(Float, default=1000.0)
    max_amount = Column(Float, default=100000.0)
    min_tenure_months = Column(Integer, default=6)
    max_tenure_months = Column(Integer, default=60)
    interest_rate = Column(Float, nullable=False)
    interest_type = Column(Enum(InterestType), default=InterestType.REDUCING_BALANCE)
    repayment_frequency = Column(Enum(RepaymentFrequency), default=RepaymentFrequency.MONTHLY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
