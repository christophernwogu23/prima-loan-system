from pydantic import BaseModel
from typing import Optional, Dict, Any

class SettingUpdate(BaseModel):
    key: str
    value: str

class SettingsResponse(BaseModel):
    # Company Info
    company_name: Optional[str] = "PRIMA"
    company_address: Optional[str] = ""
    company_phone: Optional[str] = ""
    company_logo: Optional[str] = ""
    
    # Loan Settings
    default_interest_rate: Optional[float] = 17.0
    max_loan_amount: Optional[float] = 10000000
    min_loan_amount: Optional[float] = 10000
    late_payment_penalty: Optional[float] = 5.0
    
    # System Settings
    currency: Optional[str] = "NGN"
    currency_symbol: Optional[str] = "₦"
    date_format: Optional[str] = "DD/MM/YYYY"
    force_password_change: Optional[bool] = True