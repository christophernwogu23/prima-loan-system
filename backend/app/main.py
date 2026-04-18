from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models.upfront_charge import UpfrontCharge
from app.models.fixed_deposit_transaction import FixedDepositTransaction
from app.models.shareholder_transaction import ShareholderTransaction

# Import models so they're registered with Base
from app.models.transit_account import TransitDeposit
from app.models.suspense_account import SuspensePayment
from app.models.gl_account import GLAccount
from app.models.journal_entry import JournalEntry

print("=== SERVER STARTED ===")
print(f"Environment: {settings.ENVIRONMENT}")
print(f"Debug Mode: {settings.DEBUG}")

print("=== CREATING DATABASE TABLES ===")
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully")
except Exception as e:
    print(f"⚠️ Table creation error: {e}")

# Create default GL accounts
def create_default_gl_accounts():
    """Create default Chart of Accounts if they don't exist"""
    db = SessionLocal()
    
    default_accounts = [
        # ASSETS
        {"code": "1001", "name": "Bank Account", "type": "asset", "desc": "Main company bank account"},
        {"code": "1002", "name": "Cash on Hand", "type": "asset", "desc": "Physical cash"},
        {"code": "1003", "name": "Loans Receivable", "type": "asset", "desc": "Money owed by customers"},
        {"code": "1004", "name": "Office Equipment", "type": "asset", "desc": "Computers, furniture"},
        {"code": "1005", "name": "Vehicles", "type": "asset", "desc": "Company vehicles"},
        
        # LIABILITIES
        {"code": "2001", "name": "Customer Savings", "type": "liability", "desc": "Customer deposits"},
        {"code": "2002", "name": "Fixed Deposits", "type": "liability", "desc": "Customer fixed deposits"},
        
        # EQUITY
        {"code": "3001", "name": "Shareholder Capital", "type": "equity", "desc": "Shareholder investments"},
        {"code": "3002", "name": "Retained Earnings", "type": "equity", "desc": "Accumulated profits"},
        
        # INCOME
        {"code": "4001", "name": "Interest Income", "type": "income", "desc": "Interest from loans"},
        {"code": "4002", "name": "Upfront Fee Income", "type": "income", "desc": "Processing fees"},
        
        # EXPENSES
        {"code": "5001", "name": "Salary Expense", "type": "expense", "desc": "Staff salaries"},
        {"code": "5002", "name": "Rent Expense", "type": "expense", "desc": "Office rent"},
        {"code": "5003", "name": "General Expenses", "type": "expense", "desc": "Other expenses"},
    ]
    
    for acc in default_accounts:
        existing = db.query(GLAccount).filter(GLAccount.account_code == acc["code"]).first()
        if not existing:
            gl_account = GLAccount(
                account_code=acc["code"],
                account_name=acc["name"],
                account_type=acc["type"],
                description=acc["desc"],
                current_balance=0.0
            )
            db.add(gl_account)
    
    try:
        db.commit()
        print("✅ Default GL accounts created/verified")
    except Exception as e:
        print(f"⚠️ GL account setup error: {e}")
        db.rollback()
    finally:
        db.close()

# Create default accounts
try:
    create_default_gl_accounts()
except Exception as e:
    print(f"⚠️ Error in GL setup: {e}")

app = FastAPI(
    title=settings.APP_NAME, 
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS Configuration
cors_kwargs = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    "allow_headers": ["*"],
}

if settings.cors_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Security Headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    if settings.DEBUG:
        print(f"=== REQUEST: {request.method} {request.url.path} ===", flush=True)
    response = await call_next(request)
    return response

# Import and include routers
from app.api.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/api/v1")

from app.api.v1.loan_products import router as loan_products_router
app.include_router(loan_products_router, prefix="/api/v1")

from app.api.v1.applications import router as applications_router
app.include_router(applications_router, prefix="/api/v1")

from app.api.v1.users import router as users_router
app.include_router(users_router, prefix="/api/v1")

from app.api.v1.stats import router as stats_router
app.include_router(stats_router, prefix="/api/v1")

from app.api.v1.payments import router as payments_router
app.include_router(payments_router, prefix="/api/v1")

from app.api.v1.settings import router as settings_router
app.include_router(settings_router, prefix="/api/v1")

from app.api.v1.expenses import router as expenses_router
app.include_router(expenses_router, prefix="/api/v1")

from app.api.v1.savings import router as savings_router
app.include_router(savings_router, prefix="/api/v1")

from app.api.v1.fixed_deposits import router as fixed_deposits_router
app.include_router(fixed_deposits_router, prefix="/api/v1")

from app.api.v1.import_data import router as import_router
app.include_router(import_router, prefix="/api/v1")

from app.api.v1.shareholders import router as shareholders_router
app.include_router(shareholders_router, prefix="/api/v1")

from app.api.v1.defaults import router as defaults_router
app.include_router(defaults_router, prefix="/api/v1")

from app.api.v1.notifications import router as notifications_router
app.include_router(notifications_router, prefix="/api/v1")

from app.api.v1.reports import router as reports_router
app.include_router(reports_router, prefix="/api/v1")

from app.api.v1.accounts import router as accounts_router
app.include_router(accounts_router, prefix="/api/v1")

from app.api.v1.transit_account import router as transit_router
app.include_router(transit_router, prefix="/api/v1")

from app.api.v1.suspense_account import router as suspense_router
app.include_router(suspense_router, prefix="/api/v1")

from app.api.v1.upfront import router as upfront_router
app.include_router(upfront_router, prefix="/api/v1")

print("=== LOADING GL ROUTER ===", flush=True)
from app.api.v1.general_ledger import router as gl_router
print("=== GL ROUTER LOADED ===", flush=True)
app.include_router(gl_router, prefix="/api/v1")
print("=== GL ROUTER REGISTERED ===", flush=True)

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }

@app.get("/")
async def root():
    return {
        "message": "Welcome to PRIMA API",
        "docs": "/docs",
        "health": "/health"
    }