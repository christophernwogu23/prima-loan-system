from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.loan_application import LoanApplication
from app.models.payment import Payment


router = APIRouter(prefix="/applications", tags=["Loan Applications"])

class ApplicationCreate(BaseModel):
    loan_product_id: int
    requested_amount: float
    tenure_months: int
    purpose: Optional[str] = None
    customer_id: Optional[int] = None

class ApplicationResponse(BaseModel):
    id: int
    application_number: str
    customer_id: int
    loan_product_id: int
    requested_amount: float
    tenure_months: int
    purpose: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewRequest(BaseModel):
    action: str  # "approve" or "reject"
    comments: Optional[str] = None

def generate_application_number():
    return f"APP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

@router.post("/", response_model=ApplicationResponse)
async def create_application(
    app_data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.loan_application import LoanApplication
    from app.models.loan_product import LoanProduct
    
    # Determine the customer
    if app_data.customer_id:
        # Officer applying on behalf of customer
        if current_user.role not in ["loan_officer", "manager", "admin"]:
            raise HTTPException(status_code=403, detail="Only staff can apply on behalf of customers")
        
        # Check if customer exists
        customer = db.query(User).filter(User.id == app_data.customer_id).first()
        if not customer or customer.role != "customer":
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # For loan officers, check if customer is assigned to them
        if current_user.role == "loan_officer":
            if customer.assigned_officer_id != current_user.id:
                raise HTTPException(status_code=403, detail="Customer not assigned to you")
        
        customer_id = app_data.customer_id
        assigned_officer_id = current_user.id if current_user.role == "loan_officer" else None
    else:
        # Customer applying for themselves
        if current_user.role != "customer":
            raise HTTPException(status_code=400, detail="Please specify customer_id")
        customer_id = current_user.id
        assigned_officer_id = current_user.assigned_officer_id
    
    # Check if product exists
    product = db.query(LoanProduct).filter(LoanProduct.id == app_data.loan_product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Loan product not found")
    
    # Validate amount
    if app_data.requested_amount < product.min_amount or app_data.requested_amount > product.max_amount:
        raise HTTPException(status_code=400, detail=f"Amount must be between {product.min_amount} and {product.max_amount}")
    
    # Validate tenure
    if app_data.tenure_months < product.min_tenure_months or app_data.tenure_months > product.max_tenure_months:
        raise HTTPException(status_code=400, detail=f"Tenure must be between {product.min_tenure_months} and {product.max_tenure_months} months")
    
    # Create application
    application = LoanApplication(
        application_number=generate_application_number(),
        customer_id=customer_id,
        loan_product_id=app_data.loan_product_id,
        assigned_officer_id=assigned_officer_id,
        requested_amount=app_data.requested_amount,
        tenure_months=app_data.tenure_months,
        purpose=app_data.purpose,
        interest_rate=product.interest_rate,
        status="submitted"
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    return application

@router.get("/", response_model=List[ApplicationResponse])
async def get_applications(
    month: Optional[str] = Query(None, regex="^\\d{4}-\\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.loan_application import LoanApplication
    
    query = db.query(LoanApplication)
    
    # Filter by month if provided
    if month:
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month_num + 1, 1)
        
        print(f"\n=== FILTERING BY MONTH ===")
        print(f"Month parameter: {month}")
        print(f"Start date: {start_date}")
        print(f"End date: {end_date}")
        
        query = query.filter(
            LoanApplication.created_at >= start_date,
            LoanApplication.created_at < end_date
        )
    
    # Role-based filtering
    if current_user.role == "customer":
        query = query.filter(LoanApplication.customer_id == current_user.id)
    elif current_user.role == "loan_officer":
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)
    
    applications = query.all()
    
    # Debug: Check created_at dates
    print(f"\n=== RESULTS ===")
    print(f"Total applications returned: {len(applications)}")
    if applications:
        print(f"First 3 created_at dates:")
        for app in applications[:3]:
            print(f"  App {app.id}: {app.created_at}")
    print(f"==================\n")
    
    applications = sorted(applications, key=lambda x: x.created_at or datetime.min, reverse=True)
    return applications

@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.loan_application import LoanApplication
    
    application = db.query(LoanApplication).filter(LoanApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check permission
    if current_user.role == "customer" and application.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return application

@router.patch("/{app_id}/status")
async def update_application_status(
    app_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.loan_application import LoanApplication
    
    # Only staff can update status
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Access denied")
    
    application = db.query(LoanApplication).filter(LoanApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    valid_statuses = ["submitted", "under_review", "approved", "rejected", "disbursed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    application.status = status
    if status == "approved":
        application.approved_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": f"Application status updated to {status}"}

@router.get("/user/{user_id}")
async def get_user_applications(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all applications for a specific user"""
    if current_user.role not in ["admin", "ceo", "manager", "loan_officer"]:
        if current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    applications = db.query(LoanApplication).filter(
        LoanApplication.customer_id == user_id
    ).order_by(LoanApplication.created_at.desc()).all()
    
    return applications

@router.post("/{app_id}/review")
async def review_application(
    app_id: int,
    review: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.loan_application import LoanApplication
    
    application = db.query(LoanApplication).filter(LoanApplication.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    current_status = application.status
    action = review.action.lower()
    role = current_user.role
    
    # Define what each role can do based on current status
    if role == "loan_officer":
        if current_status not in ["submitted", "SUBMITTED"]:
            raise HTTPException(status_code=400, detail="Loan officer can only review submitted applications")
        
        if action == "approve":
            application.status = "officer_approved"
        elif action == "reject":
            application.status = "officer_rejected"
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        application.assigned_officer_id = current_user.id
        application.officer_reviewed_at = datetime.utcnow()
        application.officer_comments = review.comments
    
    elif role == "manager":
        if current_status not in ["officer_approved", "officer_rejected"]:
            raise HTTPException(status_code=400, detail="Manager can only review officer-reviewed applications")
        
        if action == "approve":
            application.status = "manager_approved"
        elif action == "reject":
            application.status = "rejected"  # Final rejection
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        application.manager_reviewed_at = datetime.utcnow()
        application.manager_comments = review.comments
    
    elif role == "ceo":
        if current_status != "manager_approved":
            raise HTTPException(status_code=400, detail="CEO can only review manager-approved applications")
        
        if action == "approve":
            application.status = "disbursed"
            application.approved_amount = application.requested_amount
            application.approved_at = datetime.utcnow()
        elif action == "reject":
            application.status = "rejected"  # Final rejection
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        application.ceo_reviewed_at = datetime.utcnow()
        application.ceo_comments = review.comments
    
    elif role == "admin":
        raise HTTPException(status_code=403, detail="Admin observes but does not participate in approvals")
    
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.commit()
    db.refresh(application)
    
    return {
        "message": f"Application {action}d successfully",
        "new_status": application.status
    }

@router.put("/{application_id}")
async def update_application(
    application_id: int,
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only admin and CEO can edit
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can edit applications")
    
    application = db.query(LoanApplication).filter(LoanApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update allowed fields
    for key, value in update_data.items():
        if hasattr(application, key):
            setattr(application, key, value)
    
    db.commit()
    db.refresh(application)
    return application

@router.delete("/{application_id}")
async def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only admin and CEO can delete
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can delete applications")
    
    application = db.query(LoanApplication).filter(LoanApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check if there are any payments linked
    payments = db.query(Payment).filter(Payment.loan_application_id == application_id).count()
    if payments > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete application with {payments} payment(s). Please delete payments first."
        )
    
    db.delete(application)
    db.commit()
    return {"message": "Application deleted successfully", "id": application_id}

