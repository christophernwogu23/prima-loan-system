from app.api.deps import get_db, get_current_user
print("=== AUTH.PY LOADED ===")
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.api.deps import get_db, get_current_user
from app.core.security import verify_password, create_tokens, decode_token
from app.models import User


router = APIRouter(prefix="/auth", tags=["Authentication"])
@router.get("/test")
async def test():
    print("=== TEST ROUTE HIT ===")
    return {"message": "Auth router works!"}
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    status: str
    class Config:
        from_attributes = True

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    print(f"=== LOGIN ATTEMPT ===")
    print(f"Email: {request.email}")
    print(f"Password: {request.password}")
    
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        print("User NOT FOUND")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    print(f"User found: {user.email}")
    print(f"Hash in DB: {user.hashed_password}")
    print(f"Status: {user.status}")
    
    password_ok = verify_password(request.password, user.hashed_password)
    print(f"Password match: {password_ok}")
    
    if not password_ok:
        print("Password WRONG")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.status != "active":
        print(f"User not active: {user.status}")
        raise HTTPException(status_code=403, detail=f"Account is {user.status}")
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    print("LOGIN SUCCESS")
    return create_tokens(user.id, user.role)

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """Get new access token using refresh token"""
    payload = decode_token(request.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    return create_tokens(user.id, user.role)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user