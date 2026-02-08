from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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

router = APIRouter(prefix="/import", tags=["import"])

def generate_email(name):
    """Generate email from name"""
    parts = name.lower().strip().split()
    if len(parts) >= 2:
        email = f"{parts[0]}.{parts[1]}@prima.local"
    else:
        email = f"{parts[0]}@prima.local"
    # Remove special characters
    email = ''.join(c for c in email if c.isalnum() or c in '.@')
    return email

def clean_amount(value):
    """Convert amount to float"""
    if pd.isna(value):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    # Remove commas and currency symbols
    cleaned = str(value).replace(',', '').replace('₦', '').replace('NGN', '').strip()
    try:
        return float(cleaned)
    except:
        return 0.0

@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview data from Excel file before importing"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel file")
    
    contents = await file.read()
    
    try:
        # Read all sheets
        excel_file = pd.ExcelFile(BytesIO(contents))
        sheets = excel_file.sheet_names
        
        preview = {
            "sheets": sheets,
            "data": {}
        }
        
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

@router.post("/savings")
async def import_savings(
    file: UploadFile = File(...),
    sheet_name: str = "savings",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import customers and savings from Excel"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    contents = await file.read()
    
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        
        # Expected columns: NAMES, BALANCES
        if 'NAMES' not in df.columns and 'NAME' not in df.columns:
            # Try first column as name
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
                if not name or name.lower() == 'nan' or name.lower() == 'total':
                    continue
                
                balance = clean_amount(row.get(balance_col, 0))
                
                # Check if customer exists
                email = generate_email(name)
                existing_user = db.query(User).filter(User.email == email).first()
                
                if not existing_user:
                    # Split name into first and last
                    name_parts = name.split()
                    first_name = name_parts[0] if name_parts else name
                    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                    
                    # Create customer
                    new_user = User(
                        email=email,
                        hashed_password=default_password,
                        first_name=first_name,
                        last_name=last_name,
                        role="customer",
                        status="active"
                    )
                    db.add(new_user)
                    db.flush()
                    created_customers += 1
                    user_id = new_user.id
                else:
                    user_id = existing_user.id
                
                # Create or update savings
                existing_savings = db.query(Savings).filter(Savings.user_id == user_id).first()
                if existing_savings:
                    existing_savings.balance = balance
                else:
                    new_savings = Savings(user_id=user_id, balance=balance)
                    db.add(new_savings)
                updated_savings += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "created_customers": created_customers,
            "updated_savings": updated_savings,
            "errors": errors
        }
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
    """Import loans from Excel"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    contents = await file.read()
    
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        
        # Expected columns: NAMES, BALANCES, CO, TYPES, DATE (optional)
        created_officers = 0
        created_loans = 0
        created_customers = 0
        errors = []
        
        default_password = get_password_hash("Welcome123")
        
        # Create loan products if they don't exist
        for loan_type in df['TYPES'].dropna().unique():
            loan_type = str(loan_type).strip().upper()
            if not loan_type:
                continue
            existing_product = db.query(LoanProduct).filter(LoanProduct.name == loan_type).first()
            if not existing_product:
                new_product = LoanProduct(
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
                )
                db.add(new_product)
        db.flush()
        
        # Create loan officers
        officers = {}
        for officer_name in df['CO'].dropna().unique():
            officer_name = str(officer_name).strip().upper()
            if not officer_name or officer_name == 'OTHERS':
                continue
            
            email = f"{officer_name.lower()}@prima.local"
            existing_officer = db.query(User).filter(User.email == email).first()
            
            if not existing_officer:
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
                officers[officer_name] = existing_officer.id
        
        # Import loans
        for idx, row in df.iterrows():
            try:
                name = str(row['NAMES']).strip()
                if not name or name.lower() == 'nan' or name.lower() == 'total':
                    continue
                
                balance = clean_amount(row.get('BALANCES', 0))
                officer_name = str(row.get('CO', '')).strip().upper()
                loan_type = str(row.get('TYPES', 'PERSONAL')).strip().upper()
                
                # Parse date if available
                loan_date = row.get('DATE') if 'DATE' in df.columns else None
                if loan_date and not pd.isna(loan_date):
                    if isinstance(loan_date, str):
                        loan_date = pd.to_datetime(loan_date)
                else:
                    loan_date = datetime.now()
                
                # Find or create customer
                email = generate_email(name)
                customer = db.query(User).filter(User.email == email).first()
                
                if not customer:
                    name_parts = name.split()
                    first_name = name_parts[0] if name_parts else name
                    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                    
                    customer = User(
                        email=email,
                        hashed_password=default_password,
                        first_name=first_name,
                        last_name=last_name,
                        role="customer",
                        status="active"
                    )
                    db.add(customer)
                    db.flush()
                    created_customers += 1
                    # Assign officer to customer
                    officer_id = officers.get(officer_name)
                    if officer_id and customer.assigned_officer_id != officer_id:
                        customer.assigned_officer_id = officer_id
                                    
                # Find loan product
                product = db.query(LoanProduct).filter(LoanProduct.name == loan_type).first()
                if not product:
                    product = db.query(LoanProduct).first()
                
                # Create loan application
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
                    created_at=loan_date  # Set the date from Excel
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
    """Import fixed deposits from Excel"""
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
                if not name or name.lower() == 'nan' or name.lower() == 'total':
                    continue
                
                amount = clean_amount(row.get('AMOUNT', 0))
                interest = clean_amount(row.get('INTEREST', 0))
                duration = str(row.get('DURATION', '6 MONTHS')).strip()
                
                # Parse dates
                value_date = row.get('VALUE DATE')
                maturity_date = row.get('MATURITY DATE')
                
                if pd.isna(value_date):
                    value_date = datetime.now()
                elif isinstance(value_date, str):
                    value_date = pd.to_datetime(value_date)
                
                if pd.isna(maturity_date):
                    maturity_date = datetime.now()
                elif isinstance(maturity_date, str):
                    maturity_date = pd.to_datetime(maturity_date)
                
                new_deposit = FixedDeposit(
                    depositor_name=name,
                    amount=amount,
                    interest_amount=interest,
                    value_date=value_date,
                    maturity_date=maturity_date,
                    duration=duration,
                    status="active"
                )
                db.add(new_deposit)
                created_deposits += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "created_deposits": created_deposits,
            "errors": errors
        }
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
    """Import expenses from Excel"""
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
                if not item or item.lower() == 'nan' or item.lower() == 'total':
                    continue
                
                amount = clean_amount(row.get('AMOUNT', 0))
                
                new_expense = Expense(
                    category=item,
                    description=f"Imported from Excel",
                    amount=amount,
                    expense_date=datetime.now(),
                    recorded_by=current_user.id
                )
                db.add(new_expense)
                created_expenses += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "created_expenses": created_expenses,
            "errors": errors
        }
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
    """Import shareholders from Excel"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    contents = await file.read()
    
    try:
        df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
        
        created_shareholders = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # Try different column name variations
                name = None
                capital = 0
                
                for col in ['NAME', 'NAMES', 'SHAREHOLDER', 'SHAREHOLDERS']:
                    if col in df.columns:
                        name = str(row.get(col, '')).strip()
                        break
                
                if not name:
                    # Use first column as name
                    name = str(row.iloc[0]).strip()
                
                if not name or name.lower() == 'nan' or name.lower() == 'total':
                    continue
                
                for col in ['CAPITAL', 'AMOUNT', 'BALANCE', 'VALUE']:
                    if col in df.columns:
                        capital = clean_amount(row.get(col, 0))
                        break
                
                if capital == 0:
                    # Try second column
                    capital = clean_amount(row.iloc[1]) if len(row) > 1 else 0
                
                # Check if shareholder already exists
                existing = db.query(Shareholder).filter(Shareholder.name == name).first()
                if existing:
                    existing.capital = capital
                else:
                    new_shareholder = Shareholder(
                        name=name,
                        capital=capital
                    )
                    db.add(new_shareholder)
                created_shareholders += 1
                
            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "created_shareholders": created_shareholders,
            "errors": errors
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")