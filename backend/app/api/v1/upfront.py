from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.upfront_charge import UpfrontCharge
from app.models.loan_application import LoanApplication
from app.models.loan_product import LoanProduct

router = APIRouter(prefix="/upfront", tags=["Upfront Charges"])

BVN_AMOUNT = 1000.0
LOAN_FORM_AMOUNT = 1000.0
CREDIT_SEARCH_AMOUNT = 1000.0


class UpfrontChargeCreate(BaseModel):
    loan_application_id: int
    bvn_charge: float = 0.0
    loan_form_charge: float = 0.0
    credit_search_charge: float = 0.0
    other_charge: float = 0.0
    other_charge_label: Optional[str] = None
    is_first_timer: bool = False
    charge_date: Optional[str] = None  # "2025-01-15"
    notes: Optional[str] = None


class UpfrontChargeResponse(BaseModel):
    id: int
    loan_application_id: int
    bvn_charge: float
    loan_form_charge: float
    credit_search_charge: float
    other_charge: float
    other_charge_label: Optional[str]
    total_charge: float
    is_first_timer: bool
    charge_date: datetime
    notes: Optional[str]
    recorded_by: int
    created_at: datetime
    # Enriched fields
    customer_name: Optional[str] = None
    application_number: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/", response_model=UpfrontChargeResponse)
def create_upfront_charge(
    data: UpfrontChargeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record upfront charges for a loan application"""
    if current_user.role not in ["admin", "manager", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")

    loan = db.query(LoanApplication).filter(
        LoanApplication.id == data.loan_application_id
    ).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan application not found")

    if current_user.role == "loan_officer" and loan.assigned_officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Loan not assigned to you")

    # Validate: BVN charge only for first-timers
    bvn = data.bvn_charge if data.is_first_timer else 0.0

    total = bvn + data.loan_form_charge + data.credit_search_charge + data.other_charge

    # Parse charge date
    if data.charge_date:
        try:
            charge_dt = datetime.strptime(data.charge_date, "%Y-%m-%d")
        except ValueError:
            charge_dt = datetime.utcnow()
    else:
        charge_dt = datetime.utcnow()

    charge = UpfrontCharge(
        loan_application_id=data.loan_application_id,
        bvn_charge=bvn,
        loan_form_charge=data.loan_form_charge,
        credit_search_charge=data.credit_search_charge,
        other_charge=data.other_charge,
        other_charge_label=data.other_charge_label,
        total_charge=total,
        is_first_timer=data.is_first_timer,
        charge_date=charge_dt,
        notes=data.notes,
        recorded_by=current_user.id
    )

    db.add(charge)
    db.commit()
    db.refresh(charge)

    # Enrich response
    customer = db.query(User).filter(User.id == loan.customer_id).first()
    return {
        **charge.__dict__,
        "customer_name": f"{customer.first_name} {customer.last_name}" if customer else None,
        "application_number": loan.application_number
    }


@router.get("/")
def get_all_upfront_charges(
    month: Optional[str] = Query(None, regex="^\\d{4}-\\d{2}$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all upfront charges"""
    if current_user.role not in ["admin", "manager", "ceo", "loan_officer"]:
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(UpfrontCharge)

    if current_user.role == "loan_officer":
        # Only show charges for loans assigned to this officer
        officer_loan_ids = [
            l.id for l in db.query(LoanApplication).filter(
                LoanApplication.assigned_officer_id == current_user.id
            ).all()
        ]
        query = query.filter(UpfrontCharge.loan_application_id.in_(officer_loan_ids))

    if month:
        year, month_num = map(int, month.split("-"))
        start = datetime(year, month_num, 1)
        end = datetime(year + 1, 1, 1) if month_num == 12 else datetime(year, month_num + 1, 1)
        query = query.filter(
            UpfrontCharge.charge_date >= start,
            UpfrontCharge.charge_date < end
        )

    charges = query.order_by(UpfrontCharge.charge_date.desc()).all()

    result = []
    for charge in charges:
        loan = db.query(LoanApplication).filter(
            LoanApplication.id == charge.loan_application_id
        ).first()
        customer = db.query(User).filter(User.id == loan.customer_id).first() if loan else None
        result.append({
            "id": charge.id,
            "loan_application_id": charge.loan_application_id,
            "application_number": loan.application_number if loan else None,
            "customer_name": f"{customer.first_name} {customer.last_name}" if customer else None,
            "bvn_charge": charge.bvn_charge,
            "loan_form_charge": charge.loan_form_charge,
            "credit_search_charge": charge.credit_search_charge,
            "other_charge": charge.other_charge,
            "other_charge_label": charge.other_charge_label,
            "total_charge": charge.total_charge,
            "is_first_timer": charge.is_first_timer,
            "charge_date": charge.charge_date,
            "notes": charge.notes,
            "recorded_by": charge.recorded_by,
            "created_at": charge.created_at
        })

    return result


@router.get("/loan/{loan_id}")
def get_loan_upfront_charges(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get upfront charges for a specific loan"""
    loan = db.query(LoanApplication).filter(LoanApplication.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    charges = db.query(UpfrontCharge).filter(
        UpfrontCharge.loan_application_id == loan_id
    ).all()

    total = sum(c.total_charge for c in charges)

    return {
        "loan_id": loan_id,
        "charges": charges,
        "total_upfront": total
    }


@router.get("/summary")
def get_upfront_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get summary totals for upfront charges"""
    if current_user.role not in ["admin", "manager", "ceo"]:
        raise HTTPException(status_code=403, detail="Access denied")

    total = db.query(func.sum(UpfrontCharge.total_charge)).scalar() or 0
    total_bvn = db.query(func.sum(UpfrontCharge.bvn_charge)).scalar() or 0
    total_form = db.query(func.sum(UpfrontCharge.loan_form_charge)).scalar() or 0
    total_credit = db.query(func.sum(UpfrontCharge.credit_search_charge)).scalar() or 0
    total_other = db.query(func.sum(UpfrontCharge.other_charge)).scalar() or 0
    count = db.query(func.count(UpfrontCharge.id)).scalar() or 0

    return {
        "total_collected": total,
        "total_bvn": total_bvn,
        "total_loan_form": total_form,
        "total_credit_search": total_credit,
        "total_other": total_other,
        "transactions_count": count
    }


@router.delete("/{charge_id}")
def delete_upfront_charge(
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an upfront charge (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete upfront charges")

    charge = db.query(UpfrontCharge).filter(UpfrontCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")

    db.delete(charge)
    db.commit()
    return {"message": "Upfront charge deleted"}