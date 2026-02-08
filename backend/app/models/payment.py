from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_application_id = Column(Integer, ForeignKey("loan_applications.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String(50))  # cash, bank_transfer, cheque, mobile_money
    reference_number = Column(String(100))
    notes = Column(Text)
    recorded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    loan_application = relationship("LoanApplication", back_populates="payments")
    recorder = relationship("User", foreign_keys=[recorded_by])