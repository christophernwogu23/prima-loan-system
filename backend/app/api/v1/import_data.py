from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
from io import BytesIO
from datetime import datetime
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.savings import Savings
from app.models.loan_application import LoanApplication
from app.models.loan_product import LoanProduct
from app.models.fixed_deposit import FixedDeposit
from app.models.expense import Expense
from app.core.security import get_password_hash
from app.models.shareholder import Shareholder
from app.models.payment import Payment

router = APIRouter(prefix="/import", tags=["import"])


def generate_email(name):
    parts = name.lower().strip().split()
    if len(parts) >= 2:
        email = f"{parts[0]}.{parts[1]}@prima.local"
    else:
        email = f"{parts[0]}@prima.local"
    return ''.join(c for c in email if c.isalnum() or c in '.@')


def clean_amount(value):
    if pd.isna(value):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(',', '').replace('₦', '').replace('NGN', '').strip()
    try:
        return float(cleaned)
    except:
        return 0.0


def parse_date(value, fallback=None):
    """Parse date from Excel cell, return fallback if invalid"""
    fallback = fallback or datetime.now()
    if value is None:
        return fallback
    try:
        if isinstance(value, datetime):
            return value
        if hasattr(value, 'to_pydatetime'):
            dt = value.to_pydatetime()
            # Check for NaT
            if pd.isnull(dt):
                return fallback
            return dt
        parsed = pd.to_datetime(value)
        if pd.isnull(parsed):
            return fallback
        return parsed.to_pydatetime()
    except:
        return fallback


# ===== CLEAR ENDPOINTS =====

@router.delete("/clear/loans")
async def clear_imported_loans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all imported loan applications (IMP- prefix)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    loans = db.query(LoanApplication).filter(
        LoanApplication.application_number.like("IMP-%")
    ).all()
    count = len(loans)
    loan_ids = [l.id for l in loans]
    # Delete payments first
    db.query(Payment).filter(Payment.loan_application_id.in_(loan_ids)).delete(synchronize_session=False)
    db.query(LoanApplication).filter(LoanApplication.id.in_(loan_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {count} imported loan(s)"}


@router.delete("/clear/customers")
async def clear_imported_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all imported customers (@prima.local emails) and their savings"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    customers = db.query(User).filter(
        User.email.like("%@prima.local"),
        User.role == "customer"
    ).all()
    count = len(customers)
    customer_ids = [c.id for c in customers]
    # Delete loans first (FK constraint)
    db.query(LoanApplication).filter(LoanApplication.customer_id.in_(customer_ids)).delete(synchronize_session=False)
    # Delete savings
    db.query(Savings).filter(Savings.user_id.in_(customer_ids)).delete(synchronize_session=False)
    # Now delete customers
    db.query(User).filter(User.id.in_(customer_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {count} imported customer(s), their loans and savings"}


@router.delete("/clear/fixed-deposits")
async def clear_imported_fixed_deposits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all fixed deposits"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    count = db.query(FixedDeposit).delete()
    db.commit()
    return {"message": f"Deleted {count} fixed deposit(s)"}


@router.delete("/clear/expenses")
async def clear_imported_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all imported expenses"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    count = db.query(Expense).filter(
        Expense.description == "Imported from Excel"
    ).delete()
    db.commit()
    return {"message": f"Deleted {count} imported expense(s)"}


@router.delete("/clear/shareholders")
async def clear_imported_shareholders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all shareholders"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    count = db.query(Shareholder).delete()
    db.commit()
    return {"message": f"Deleted {count} shareholder(s)"}


@router.delete("/clear/all")
async def clear_all_imported_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete ALL imported data at once"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Delete in correct order to avoid FK violations
    loans_count = db.query(LoanApplication).filter(
        LoanApplication.application_number.like("IMP-%")
    ).count()
    db.query(LoanApplication).filter(
        LoanApplication.application_number.like("IMP-%")
    ).delete(synchronize_session=False)

    customers = db.query(User).filter(
        User.email.like("%@prima.local"),
        User.role == "customer"
    ).all()
    customers_count = len(customers)
    customer_ids = [c.id for c in customers]
    # Delete payments → loans → savings → customers in correct order
    loan_ids = [l.id for l in db.query(LoanApplication).filter(LoanApplication.customer_id.in_(customer_ids)).all()]
    db.query(Payment).filter(Payment.loan_application_id.in_(loan_ids)).delete(synchronize_session=False)
    all_loans_count = db.query(LoanApplication).filter(LoanApplication.customer_id.in_(customer_ids)).delete(synchronize_session=False)
    db.query(Savings).filter(Savings.user_id.in_(customer_ids)).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_(customer_ids)).delete(synchronize_session=False)

    fd_count = db.query(FixedDeposit).delete()
    exp_count = db.query(Expense).filter(Expense.description == "Imported from Excel").delete()
    sh_count = db.query(Shareholder).delete()

    db.commit()

    return {
        "message": "All imported data cleared successfully",
        "deleted": {
            "loans": loans_count,
            "customers": customers_count,
            "fixed_deposits": fd_count,
            "expenses": exp_count,
            "shareholders": sh_count
        }
    }


# ===== PREVIEW =====

@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel file")

    contents = await file.read()
    try:
        excel_file = pd.ExcelFile(BytesIO(contents))
        sheets = excel_file.sheet_names
        preview = {"sheets": sheets, "data": {}}
        for sheet in sheets:
            df = pd.read_excel(BytesIO(contents), sheet_name=sheet)
            preview["data"][sheet] = {
                "columns": df.columns.tolist(),
                "row_count": len(df),
                "sample": df.head(5).fillna('').to_dict('records')
            }
        return preview
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")


# ===== IMPORT ENDPOINTS =====

@router.post("/savings")
async def import_savings(
    file: UploadFile = File(...),
    sheet_name: str = "savings",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)

        if 'NAMES' not in df.columns and 'NAME' not in df.columns:
            df.columns = ['NAMES', 'BALANCES'] + list(df.columns[2:])

        name_col = 'NAMES' if 'NAMES' in df.columns else 'NAME'
        balance_col = 'BALANCES' if 'BALANCES' in df.columns else 'BALANCE'

        created_customers = 0
        updated_savings = 0
        errors = []
        default_password = get_password_hash("Welcome123")

        for idx, row in df.iterrows():
            try:
                name = str(row[name_col]).strip()
                if not name or name.lower() in ('nan', 'total'):
                    continue

                balance = clean_amount(row.get(balance_col, 0))
                email = generate_email(name)
                existing_user = db.query(User).filter(User.email == email).first()

                if not existing_user:
                    name_parts = name.split()
                    new_user = User(
                        email=email,
                        hashed_password=default_password,
                        first_name=name_parts[0],
                        last_name=' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
                        role="customer",
                        status="active"
                    )
                    db.add(new_user)
                    db.flush()
                    created_customers += 1
                    user_id = new_user.id
                else:
                    user_id = existing_user.id

                existing_savings = db.query(Savings).filter(Savings.user_id == user_id).first()
                if existing_savings:
                    existing_savings.balance = balance
                else:
                    db.add(Savings(user_id=user_id, balance=balance))
                updated_savings += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db.commit()
        return {"success": True, "created_customers": created_customers, "updated_savings": updated_savings, "errors": errors}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/loans")
async def import_loans(
    file: UploadFile = File(...),
    sheet_name: str = "loans",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)

        created_officers = 0
        created_loans = 0
        created_customers = 0
        errors = []
        default_password = get_password_hash("Welcome123")

        # Create loan products
        for loan_type in df['TYPES'].dropna().unique():
            loan_type = str(loan_type).strip().upper()
            if not loan_type:
                continue
            if not db.query(LoanProduct).filter(LoanProduct.name == loan_type).first():
                db.add(LoanProduct(
                    name=loan_type,
                    code=loan_type.upper().replace(' ', '_'),
                    description=f"{loan_type} Loan",
                    interest_rate=17.0,
                    interest_type="REDUCING_BALANCE",
                    repayment_frequency="MONTHLY",
                    min_amount=10000,
                    max_amount=10000000,
                    min_tenure_months=1,
                    max_tenure_months=24,
                    is_active=True
                ))
        db.flush()

        # Create loan officers
        officers = {}
        for officer_name in df['CO'].dropna().unique():
            officer_name = str(officer_name).strip().upper()
            if not officer_name or officer_name == 'OTHERS':
                continue
            email = f"{officer_name.lower()}@prima.local"
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                new_officer = User(
                    email=email,
                    hashed_password=default_password,
                    first_name=officer_name.title(),
                    last_name="",
                    role="loan_officer",
                    status="active"
                )
                db.add(new_officer)
                db.flush()
                officers[officer_name] = new_officer.id
                created_officers += 1
            else:
                officers[officer_name] = existing.id

        # Import loans
        for idx, row in df.iterrows():
            try:
                name = str(row['NAMES']).strip()
                if not name or name.lower() in ('nan', 'total'):
                    continue

                balance = clean_amount(row.get('BALANCES', 0))
                officer_name = str(row.get('CO', '')).strip().upper()
                loan_type = str(row.get('TYPES', 'PERSONAL')).strip().upper()

                # Read date from Excel — use original date if available
                loan_date = parse_date(row.get('DATE') if 'DATE' in df.columns else None)
                approved_date = parse_date(row.get('APPROVED_DATE') if 'APPROVED_DATE' in df.columns else None, loan_date)

                email = generate_email(name)
                customer = db.query(User).filter(User.email == email).first()

                if not customer:
                    name_parts = name.split()
                    customer = User(
                        email=email,
                        hashed_password=default_password,
                        first_name=name_parts[0],
                        last_name=' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
                        role="customer",
                        status="active"
                    )
                    db.add(customer)
                    db.flush()
                    created_customers += 1
                    officer_id = officers.get(officer_name)
                    if officer_id:
                        customer.assigned_officer_id = officer_id

                product = db.query(LoanProduct).filter(LoanProduct.name == loan_type).first()
                if not product:
                    product = db.query(LoanProduct).first()

                app_number = f"IMP-{loan_date.strftime('%Y%m%d')}-{idx:04d}"

                new_loan = LoanApplication(
                    application_number=app_number,
                    customer_id=customer.id,
                    loan_product_id=product.id,
                    assigned_officer_id=officers.get(officer_name),
                    requested_amount=balance,
                    approved_amount=balance,
                    tenure_months=12,
                    interest_rate=product.interest_rate,
                    status="disbursed",
                    purpose="Imported from Excel",
                    created_at=loan_date,
                    approved_at=approved_date
                )
                db.add(new_loan)
                created_loans += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db.commit()
        return {
            "success": True,
            "created_officers": created_officers,
            "created_customers": created_customers,
            "created_loans": created_loans,
            "errors": errors
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/fixed-deposits")
async def import_fixed_deposits(
    file: UploadFile = File(...),
    sheet_name: str = "fixed deposit",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        created_deposits = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                name = str(row.get('NAME', '')).strip()
                if not name or name.lower() in ('nan', 'total', 'nat', '') or pd.isna(row.get('NAME', '')):
                    continue

                amount = clean_amount(row.get('AMOUNT', 0))
                if amount == 0:
                    continue
                interest = clean_amount(row.get('INTEREST', 0))
                duration = str(row.get('DURATION', '6 MONTHS')).strip()
                value_date = parse_date(row.get('VALUE DATE'))
                maturity_date = parse_date(row.get('MATURITY DATE'))

                db.add(FixedDeposit(
                    depositor_name=name,
                    amount=amount,
                    interest_amount=interest,
                    value_date=value_date,
                    maturity_date=maturity_date,
                    duration=duration,
                    status="active"
                ))
                created_deposits += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db.commit()
        return {"success": True, "created_deposits": created_deposits, "errors": errors}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/expenses")
async def import_expenses(
    file: UploadFile = File(...),
    sheet_name: str = "expenses",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        created_expenses = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                item = str(row.get('ITEM', '')).strip()
                if not item or item.lower() in ('nan', 'total'):
                    continue

                amount = clean_amount(row.get('AMOUNT', 0))

                # Read date from Excel if available, else use today
                expense_date = parse_date(row.get('DATE') if 'DATE' in df.columns else None)

                db.add(Expense(
                    category=item,
                    description="Imported from Excel",
                    amount=amount,
                    expense_date=expense_date,
                    recorded_by=current_user.id
                ))
                created_expenses += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db.commit()
        return {"success": True, "created_expenses": created_expenses, "errors": errors}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/shareholders")
async def import_shareholders(
    file: UploadFile = File(...),
    sheet_name: str = "shares",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        created_shareholders = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                name = None
                for col in ['NAME', 'NAMES', 'SHAREHOLDER', 'SHAREHOLDERS']:
                    if col in df.columns:
                        name = str(row.get(col, '')).strip()
                        break
                if not name:
                    name = str(row.iloc[0]).strip()

                if not name or name.lower() in ('nan', 'total'):
                    continue

                capital = 0
                for col in ['CAPITAL', 'AMOUNT', 'BALANCE', 'VALUE']:
                    if col in df.columns:
                        capital = clean_amount(row.get(col, 0))
                        break
                if capital == 0 and len(row) > 1:
                    capital = clean_amount(row.iloc[1])

                existing = db.query(Shareholder).filter(Shareholder.name == name).first()
                if existing:
                    existing.capital = capital
                else:
                    db.add(Shareholder(name=name, capital=capital))
                created_shareholders += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db.commit()
        return {"success": True, "created_shareholders": created_shareholders, "errors": errors}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")