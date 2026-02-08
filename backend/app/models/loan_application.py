from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    OFFICER_APPROVED = "officer_approved"
    OFFICER_REJECTED = "officer_rejected"
    MANAGER_APPROVED = "manager_approved"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISBURSED = "disbursed"

class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class LoanApplication(Base):
    __tablename__ = "loan_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    loan_product_id = Column(Integer, ForeignKey("loan_products.id"), nullable=False)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_amount = Column(Float, nullable=False)
    approved_amount = Column(Float, nullable=True)
    tenure_months = Column(Integer, nullable=False)
    purpose = Column(Text, nullable=True)
    interest_rate = Column(Float, nullable=True)
    emi_amount = Column(Float, nullable=True)
    status = Column(String(50), default="submitted")
    risk_level = Column(Enum(RiskLevel), nullable=True)
    internal_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    payments = relationship("Payment", back_populates="loan_application")
    officer_reviewed_at = Column(DateTime, nullable=True)
    officer_comments = Column(Text, nullable=True)
    manager_reviewed_at = Column(DateTime, nullable=True)
    manager_comments = Column(Text, nullable=True)
    ceo_reviewed_at = Column(DateTime, nullable=True)
    ceo_comments = Column(Text, nullable=True)
