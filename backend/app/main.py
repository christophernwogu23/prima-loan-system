from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.config import settings

print("=== SERVER STARTED ===")
print(f"Environment: {settings.ENVIRONMENT}")
print(f"Debug Mode: {settings.DEBUG}")

app = FastAPI(
    title=settings.APP_NAME, 
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# CORS Configuration - Dynamic based on environment
cors_kwargs = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

# Add regex for Vercel preview deployments in production
if settings.cors_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)

# Compress responses
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