from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Use the database_url property (lowercase)
SQLALCHEMY_DATABASE_URL = settings.database_url

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # Test connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=10,        # Connection pool size
    max_overflow=20,     # Allow extra connections if needed
    echo=settings.DEBUG  # Log SQL queries in debug mode
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()