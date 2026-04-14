from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, Text, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class UpfrontCharge(Base):
    __tablename__ = "upfront_charges"

    id = Column(Integer, primary_key=True, index=True)
    loan_application_id = Column(Integer, ForeignKey("loan_applications.id"), nullable=False)

    # Charge components — all optional
    bvn_charge = Column(Float, default=0.0)           # ₦1,000 for first-timers only
    loan_form_charge = Column(Float, default=0.0)     # ₦1,000
    credit_search_charge = Column(Float, default=0.0) # ₦1,000
    other_charge = Column(Float, default=0.0)         # Any other upfront fee
    other_charge_label = Column(String(200), nullable=True)  # Label for other charge

    total_charge = Column(Float, default=0.0)         # Sum of all charges

    is_first_timer = Column(Boolean, default=False)   # Flags if BVN charge applies
    charge_date = Column(DateTime, nullable=False)    # Can differ from disbursement date
    notes = Column(Text, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    loan_application = relationship("LoanApplication", foreign_keys=[loan_application_id])
    recorder = relationship("User", foreign_keys=[recorded_by])