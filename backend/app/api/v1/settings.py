from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.settings import Settings
from app.schemas.settings import SettingUpdate, SettingsResponse

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "company_name": "PRIMA",
    "company_address": "",
    "company_phone": "",
    "company_logo": "",
    "default_interest_rate": "17.0",
    "max_loan_amount": "10000000",
    "min_loan_amount": "10000",
    "late_payment_penalty": "5.0",
    "currency": "NGN",
    "currency_symbol": "₦",
    "date_format": "DD/MM/YYYY",
    "force_password_change": "true"
}

@router.get("/", response_model=Dict[str, str])
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all settings"""
    settings = db.query(Settings).all()
    
    # Start with defaults
    result = DEFAULT_SETTINGS.copy()
    
    # Override with database values
    for setting in settings:
        result[setting.key] = setting.value
    
    return result

@router.put("/")
def update_setting(
    setting: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a single setting (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if setting exists
    db_setting = db.query(Settings).filter(Settings.key == setting.key).first()
    
    if db_setting:
        db_setting.value = setting.value
    else:
        db_setting = Settings(key=setting.key, value=setting.value)
        db.add(db_setting)
    
    db.commit()
    
    return {"message": "Setting updated", "key": setting.key, "value": setting.value}

@router.put("/bulk")
def update_settings_bulk(
    settings: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update multiple settings at once (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    for key, value in settings.items():
        db_setting = db.query(Settings).filter(Settings.key == key).first()
        
        if db_setting:
            db_setting.value = value
        else:
            db_setting = Settings(key=key, value=value)
            db.add(db_setting)
    
    db.commit()
    
    return {"message": "Settings updated", "count": len(settings)}