from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Shareholder(Base):
    __tablename__ = "shareholders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    capital = Column(Float, nullable=False, default=0)
    notes = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())