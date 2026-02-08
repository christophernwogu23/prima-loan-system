from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.loan_application import LoanApplication
from app.models.payment import Payment

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for the current user based on their role"""
    notifications = []
    
    if current_user.role == "customer":
        # Customer notifications
        # 1. Application status updates
        my_applications = db.query(LoanApplication).filter(
            LoanApplication.customer_id == current_user.id
        ).order_by(LoanApplication.created_at.desc()).limit(10).all()
        
        for app in my_applications:
            if app.status in ["officer_approved", "manager_approved", "disbursed"]:
                notifications.append({
                    "id": f"app-{app.id}",
                    "type": "application_approved",
                    "title": "Application Update",
                    "message": f"Your application {app.application_number} has been {app.status.replace('_', ' ')}",
                    "date": app.updated_at,
                    "read": False
                })
            elif app.status == "rejected":
                notifications.append({
                    "id": f"app-{app.id}",
                    "type": "application_rejected",
                    "title": "Application Rejected",
                    "message": f"Your application {app.application_number} was rejected",
                    "date": app.updated_at,
                    "read": False
                })
        
        # 2. Recent payments
        loan_ids = [app.id for app in my_applications]
        recent_payments = db.query(Payment).filter(
            Payment.loan_application_id.in_(loan_ids)
        ).order_by(Payment.payment_date.desc()).limit(5).all()
        
        for payment in recent_payments:
            notifications.append({
                "id": f"payment-{payment.id}",
                "type": "payment_recorded",
                "title": "Payment Received",
                "message": f"Payment of ₦{payment.amount:,.0f} recorded",
                "date": payment.payment_date,
                "read": False
            })
    
    elif current_user.role == "loan_officer":
        # Loan officer notifications
        # Pending applications needing review
        pending = db.query(LoanApplication).filter(
            LoanApplication.assigned_officer_id == current_user.id,
            LoanApplication.status == "submitted"
        ).order_by(LoanApplication.created_at.desc()).all()
        
        for app in pending:
            notifications.append({
                "id": f"app-{app.id}",
                "type": "review_needed",
                "title": "Review Needed",
                "message": f"Application {app.application_number} awaiting your review",
                "date": app.created_at,
                "read": False
            })
    
    elif current_user.role == "manager":
        # Manager notifications
        pending = db.query(LoanApplication).filter(
            LoanApplication.status.in_(["officer_approved", "officer_rejected"])
        ).order_by(LoanApplication.updated_at.desc()).all()
        
        for app in pending:
            notifications.append({
                "id": f"app-{app.id}",
                "type": "review_needed",
                "title": "Review Needed",
                "message": f"Application {app.application_number} awaiting manager review",
                "date": app.updated_at,
                "read": False
            })
    
    elif current_user.role == "ceo":
        # CEO notifications
        pending = db.query(LoanApplication).filter(
            LoanApplication.status == "manager_approved"
        ).order_by(LoanApplication.created_at.desc()).all()
        
        for app in pending:
            notifications.append({
                "id": f"app-{app.id}",
                "type": "review_needed",
                "title": "Final Approval Needed",
                "message": f"Application {app.application_number} awaiting CEO approval",
                "date": app.updated_at,
                "read": False
            })
    
    elif current_user.role == "admin":
        # Admin notifications - system overview
        recent_apps = db.query(LoanApplication).order_by(
            LoanApplication.created_at.desc()
        ).limit(10).all()
        
        for app in recent_apps:
            notifications.append({
                "id": f"app-{app.id}",
                "type": "new_application",
                "title": "New Application",
                "message": f"Application {app.application_number} submitted",
                "date": app.created_at,
                "read": False
            })
    
    # Sort by date
    notifications.sort(key=lambda x: x["date"], reverse=True)
    
    return notifications[:20]  # Return max 20 notifications

@router.post("/generate-payment-reminders")
async def trigger_payment_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate payment reminder notifications (Admin/CEO only)"""
    
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    from app.utils.payment_scheduler import generate_payment_reminders
    
    count = generate_payment_reminders(db)
    
    return {
        "message": f"Generated {count} payment reminders",
        "count": count
    }