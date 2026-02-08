from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.core.security import decode_token
from app.models import User

security = HTTPBearer()

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    print(f"=== GET CURRENT USER ===")
    token = credentials.credentials
    print(f"Token received: {token[:20]}...")
    
    payload = decode_token(token)
    print(f"Payload: {payload}")
    
    if not payload or payload.get("type") != "access":
        print("Invalid token!")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user_id = payload.get("sub")
    print(f"User ID from token: {user_id}")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        print("User not found!")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    
    if user.status != "active":
        print(f"User not active: {user.status}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    
    print(f"Current user: {user.email}, Role: {user.role}")
    return user