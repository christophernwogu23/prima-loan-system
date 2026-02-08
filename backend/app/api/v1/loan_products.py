from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models import User

router = APIRouter(prefix="/loan-products", tags=["Loan Products"])

class LoanProductResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    min_tenure_months: Optional[int] = None
    max_tenure_months: Optional[int] = None
    interest_rate: float
    interest_type: Optional[str] = None
    repayment_frequency: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[LoanProductResponse])
async def get_loan_products(db: Session = Depends(get_db)):
    from app.models.loan_product import LoanProduct
    products = db.query(LoanProduct).all()
    return products

@router.get("/{product_id}", response_model=LoanProductResponse)
async def get_loan_product(product_id: int, db: Session = Depends(get_db)):
    from app.models.loan_product import LoanProduct
    product = db.query(LoanProduct).filter(LoanProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Loan product not found")
    return product

@router.delete("/{product_id}")
async def delete_loan_product(
    product_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only admin and CEO can delete loan products
    if current_user.role not in ["admin", "ceo"]:
        raise HTTPException(status_code=403, detail="Only admin and CEO can delete loan products")
    
    from app.models.loan_product import LoanProduct
    from app.models.loan_application import LoanApplication
    
    # Check if product exists
    product = db.query(LoanProduct).filter(LoanProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Loan product not found")
    
    # Check if any loan applications are using this product
    applications_count = db.query(LoanApplication).filter(
        LoanApplication.loan_product_id == product_id
    ).count()
    
    if applications_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete this loan product. It is being used by {applications_count} loan application(s)."
        )
    
    # Delete the product
    db.delete(product)
    db.commit()
    
    return {"message": "Loan product deleted successfully", "id": product_id}