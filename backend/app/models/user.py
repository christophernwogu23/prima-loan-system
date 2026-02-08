from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base  # Changed from app.db.base_class
from app.models.loan_application import LoanApplication
from app.models.payment import Payment

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)  # Middle name field
    last_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, manager, loan_officer, customer
    status = Column(String, default="active")  # active, pending, suspended
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    savings = relationship("Savings", back_populates="user", uselist=False)

    @property
    def full_name(self) -> str:
        middle = f" {self.middle_name}" if self.middle_name else ""
        return f"{self.first_name}{middle} {self.last_name}"