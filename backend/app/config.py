from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "PRIMA - Loan Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "loan_management"
    
    # Optional: Direct DATABASE_URL for Render deployment
    DATABASE_URL: str = None
    
    @property
    def database_url(self) -> str:
        """Construct DATABASE_URL from individual fields if not provided"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    
    @property
    def cors_origins(self) -> List[str]:
        """Dynamic CORS origins based on environment"""
        if self.ENVIRONMENT == "production":
            return [self.FRONTEND_URL]
        else:
            # Development - allow multiple localhost ports
            return [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                self.FRONTEND_URL
            ]
    
    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()