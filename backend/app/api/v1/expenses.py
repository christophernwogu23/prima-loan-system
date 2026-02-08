from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseResponse

router = APIRouter(prefix="/expenses", tags=["expenses"])

EXPENSE_CATEGORIES = [
    "Staff Salary & Allowances",
    "Rent Expense",
    "Repairs & Mainte-Office Building",
    "Fuel - Generator",
    "Fuel - Motor Vehicle",
    "Travelling & Transportation Exp",
    "Repairs & Maintenance-Generator",
    "Security",
    "Entertainment",
    "Bank Charges & Stamp Duty",
    "Fixed Deposit Interest Paid",
    "Electricity & Utilities",
    "Office Running Expenses",
    "Staff Welfare & Medical Expense",
    "Printing & Stationeries",
    "IT Related Expenses",
    "Professional Fees",
    "Audit Fees",
    "Insurance Expense",
    "Other Expense"
]

@router.get("/categories")
def get_expense_categories():
    """Get list of expense categories"""
    return EXPENSE_CATEGORIES

@router.post("/", response_model=ExpenseResponse)
def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new expense (Admin, CEO, Manager only)"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db_expense = Expense(
        category=expense.category,
        description=expense.description,
        amount=expense.amount,
        expense_date=expense.expense_date or datetime.utcnow(),
        recorded_by=current_user.id
    )
    
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    return ExpenseResponse(
        id=db_expense.id,
        category=db_expense.category,
        description=db_expense.description,
        amount=db_expense.amount,
        expense_date=db_expense.expense_date,
        recorded_by=db_expense.recorded_by,
        created_at=db_expense.created_at,
        recorder_name=current_user.first_name + " " + current_user.last_name
    )

@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all expenses (Admin, CEO, Manager only)"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    results = db.query(
        Expense,
        User.first_name,
        User.last_name
    ).join(
        User, Expense.recorded_by == User.id
    ).order_by(Expense.expense_date.desc()).all()
    
    expenses = []
    for expense, first_name, last_name in results:
        expenses.append(ExpenseResponse(
            id=expense.id,
            category=expense.category,
            description=expense.description,
            amount=expense.amount,
            expense_date=expense.expense_date,
            recorded_by=expense.recorded_by,
            created_at=expense.created_at,
            recorder_name=f"{first_name} {last_name}"
        ))
    
    return expenses

@router.get("/summary")
def get_expense_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get expense summary by category"""
    if current_user.role not in ["admin", "ceo", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Total expenses
    total = db.query(func.sum(Expense.amount)).scalar() or 0
    
    # By category
    by_category = db.query(
        Expense.category,
        func.sum(Expense.amount).label("total")
    ).group_by(Expense.category).all()
    
    # This month
    now = datetime.utcnow()
    this_month = db.query(func.sum(Expense.amount)).filter(
        extract('month', Expense.expense_date) == now.month,
        extract('year', Expense.expense_date) == now.year
    ).scalar() or 0
    
    return {
        "total": total,
        "this_month": this_month,
        "by_category": [{"category": cat, "total": amt} for cat, amt in by_category]
    }

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an expense (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(expense)
    db.commit()
    
    return {"message": "Expense deleted"}