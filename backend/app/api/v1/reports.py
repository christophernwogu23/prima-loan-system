from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.loan_application import LoanApplication
from app.models.loan_product import LoanProduct
from app.models.payment import Payment
from app.models.savings import Savings
from app.models.expense import Expense
from app.models.fixed_deposit import FixedDeposit
from app.models.shareholder import Shareholder

router = APIRouter(prefix="/reports", tags=["Reports"])

def create_download_response(wb: Workbook, report_name: str):
    """Helper to create download response"""
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    filename = f'PRIMA_{report_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    
    return StreamingResponse(
        excel_file,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@router.get("/export/{report_type}")
async def export_report(
    report_type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export different types of reports"""
    
    # Only management can export
    if current_user.role not in ["manager", "ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if report_type == "balance_sheet":
        return generate_balance_sheet(db, start_date, end_date)
    elif report_type == "profit_loss":
        return generate_profit_loss(db, start_date, end_date)
    elif report_type == "interest":
        return generate_interest_report(db, start_date, end_date)
    elif report_type == "upfront":
        return generate_upfront_report(db, start_date, end_date)
    elif report_type == "loan_disbursement":
        return generate_loan_disbursement(db, start_date, end_date)
    elif report_type == "fixed_deposit":
        return generate_fixed_deposit_report(db, start_date, end_date)
    elif report_type == "fixed_assets":
        return generate_fixed_assets_report(db, start_date, end_date)
    elif report_type == "savings":
        return generate_savings_report(db, start_date, end_date)
    elif report_type == "shares":
        return generate_shares_report(db, start_date, end_date)
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")

def generate_balance_sheet(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Balance Sheet"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Balance Sheet"
    
    ws['A1'] = 'PRIMA - BALANCE SHEET'
    ws['A1'].font = Font(bold=True, size=14)
    ws['A2'] = f'As at {datetime.now().strftime("%B %d, %Y")}'
    
    ws['A4'] = 'ASSETS'
    ws['A4'].font = Font(bold=True, size=12)
    
    row = 5
    ws[f'A{row}'] = 'Current Assets'
    ws[f'A{row}'].font = Font(bold=True)
    row += 1
    
    total_cash = db.query(func.sum(Payment.amount)).scalar() or 0
    ws[f'A{row}'] = 'Cash and Bank'
    ws[f'B{row}'] = f'₦{total_cash:,.2f}'
    row += 1
    
    disbursed_loans = db.query(LoanApplication).filter(LoanApplication.status == "disbursed").all()
    total_disbursed = sum(loan.approved_amount or loan.requested_amount for loan in disbursed_loans)
    total_repaid = db.query(func.sum(Payment.amount)).scalar() or 0
    loans_receivable = total_disbursed - total_repaid
    
    ws[f'A{row}'] = 'Loans Receivable'
    ws[f'B{row}'] = f'₦{loans_receivable:,.2f}'
    row += 1
    
    total_assets = total_cash + loans_receivable
    ws[f'A{row}'] = 'Total Assets'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total_assets:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    row += 2
    
    ws[f'A{row}'] = 'LIABILITIES'
    ws[f'A{row}'].font = Font(bold=True, size=12)
    row += 1
    
    total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
    ws[f'A{row}'] = 'Customer Savings'
    ws[f'B{row}'] = f'₦{total_savings:,.2f}'
    row += 1
    
    total_fixed_deposits = db.query(func.sum(FixedDeposit.amount)).scalar() or 0
    ws[f'A{row}'] = 'Fixed Deposits'
    ws[f'B{row}'] = f'₦{total_fixed_deposits:,.2f}'
    row += 1
    
    total_liabilities = total_savings + total_fixed_deposits
    ws[f'A{row}'] = 'Total Liabilities'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total_liabilities:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    row += 2
    
    ws[f'A{row}'] = 'EQUITY'
    ws[f'A{row}'].font = Font(bold=True, size=12)
    row += 1
    
    shareholder_capital = db.query(func.sum(Shareholder.capital)).scalar() or 0
    ws[f'A{row}'] = 'Shareholder Capital'
    ws[f'B{row}'] = f'₦{shareholder_capital:,.2f}'
    row += 1
    
    retained_earnings = total_assets - total_liabilities - shareholder_capital
    ws[f'A{row}'] = 'Retained Earnings'
    ws[f'B{row}'] = f'₦{retained_earnings:,.2f}'
    row += 1
    
    total_equity = shareholder_capital + retained_earnings
    ws[f'A{row}'] = 'Total Equity'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total_equity:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 20
    
    return create_download_response(wb, "Balance_Sheet")

def generate_profit_loss(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Profit & Loss"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Profit & Loss"
    
    payments_query = db.query(Payment)
    expenses_query = db.query(Expense)
    
    if start_date:
        payments_query = payments_query.filter(Payment.payment_date >= start_date)
        expenses_query = expenses_query.filter(Expense.expense_date >= start_date)
    if end_date:
        payments_query = payments_query.filter(Payment.payment_date <= end_date)
        expenses_query = expenses_query.filter(Expense.expense_date <= end_date)
    
    ws['A1'] = 'PRIMA - PROFIT & LOSS'
    ws['A1'].font = Font(bold=True, size=14)
    ws['A2'] = f'Period: {start_date or "Start"} to {end_date or datetime.now().strftime("%Y-%m-%d")}'
    
    row = 4
    ws[f'A{row}'] = 'REVENUE'
    ws[f'A{row}'].font = Font(bold=True, size=12)
    row += 1
    
    total_revenue = payments_query.with_entities(func.sum(Payment.amount)).scalar() or 0
    ws[f'A{row}'] = 'Loan Repayments'
    ws[f'B{row}'] = f'₦{total_revenue:,.2f}'
    row += 1
    
    disbursed_loans = db.query(LoanApplication).filter(LoanApplication.status == "disbursed")
    if start_date:
        disbursed_loans = disbursed_loans.filter(LoanApplication.created_at >= start_date)
    if end_date:
        disbursed_loans = disbursed_loans.filter(LoanApplication.created_at <= end_date)
    
    interest_income = 0
    for loan in disbursed_loans.all():
        if loan.approved_amount and loan.interest_rate:
            interest = (loan.approved_amount * loan.interest_rate / 100)
            interest_income += interest
    
    ws[f'A{row}'] = 'Interest Income'
    ws[f'B{row}'] = f'₦{interest_income:,.2f}'
    row += 1
    
    total_revenue_with_interest = total_revenue + interest_income
    ws[f'A{row}'] = 'Total Revenue'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total_revenue_with_interest:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    row += 2
    
    ws[f'A{row}'] = 'EXPENSES'
    ws[f'A{row}'].font = Font(bold=True, size=12)
    row += 1
    
    expenses = expenses_query.all()
    expense_categories = {}
    for expense in expenses:
        cat = expense.category or "Other"
        expense_categories[cat] = expense_categories.get(cat, 0) + expense.amount
    
    for category, amount in expense_categories.items():
        ws[f'A{row}'] = category
        ws[f'B{row}'] = f'₦{amount:,.2f}'
        row += 1
    
    total_expenses = sum(expense_categories.values())
    ws[f'A{row}'] = 'Total Expenses'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total_expenses:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    row += 2
    
    net_profit = total_revenue_with_interest - total_expenses
    ws[f'A{row}'] = 'NET PROFIT'
    ws[f'A{row}'].font = Font(bold=True, size=12)
    ws[f'B{row}'] = f'₦{net_profit:,.2f}'
    ws[f'B{row}'].font = Font(bold=True, size=12)
    
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 20
    
    return create_download_response(wb, "Profit_Loss")

def generate_interest_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Interest Report"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Interest"
    
    ws['A1'] = 'PRIMA - INTEREST INCOME'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Loan ID', 'Customer', 'Principal', 'Rate', 'Interest']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    loans_query = db.query(LoanApplication).filter(LoanApplication.status == "disbursed")
    if start_date:
        loans_query = loans_query.filter(LoanApplication.created_at >= start_date)
    if end_date:
        loans_query = loans_query.filter(LoanApplication.created_at <= end_date)
    
    loans = loans_query.all()
    
    row = 4
    total_principal = 0
    total_interest = 0
    
    for loan in loans:
        customer = db.query(User).filter(User.id == loan.customer_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
        
        principal = loan.approved_amount or loan.requested_amount
        rate = loan.interest_rate or 0
        interest = principal * (rate / 100)
        
        ws[f'A{row}'] = loan.application_number
        ws[f'B{row}'] = customer_name
        ws[f'C{row}'] = f'₦{principal:,.2f}'
        ws[f'D{row}'] = f'{rate}%'
        ws[f'E{row}'] = f'₦{interest:,.2f}'
        
        total_principal += principal
        total_interest += interest
        row += 1
    
    row += 1
    ws[f'A{row}'] = 'TOTALS'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'C{row}'] = f'₦{total_principal:,.2f}'
    ws[f'C{row}'].font = Font(bold=True)
    ws[f'E{row}'] = f'₦{total_interest:,.2f}'
    ws[f'E{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E']:
        ws.column_dimensions[col].width = 18
    
    return create_download_response(wb, "Interest")

def generate_upfront_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Upfront Charges"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Upfront"
    
    ws['A1'] = 'PRIMA - UPFRONT CHARGES'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Loan ID', 'Customer', 'Amount', 'Admin(2%)', 'Insurance(1%)', 'Form', 'Credit', 'BVN', 'Total']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    loans_query = db.query(LoanApplication).filter(LoanApplication.status == "disbursed")
    if start_date:
        loans_query = loans_query.filter(LoanApplication.created_at >= start_date)
    if end_date:
        loans_query = loans_query.filter(LoanApplication.created_at <= end_date)
    
    loans = loans_query.all()
    
    row = 4
    grand_total = 0
    
    for loan in loans:
        customer = db.query(User).filter(User.id == loan.customer_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
        
        amount = loan.approved_amount or loan.requested_amount
        admin_fee = amount * 0.02
        insurance = amount * 0.01
        form = 1000
        credit = 500
        bvn = 500
        total = admin_fee + insurance + form + credit + bvn
        
        ws[f'A{row}'] = loan.application_number
        ws[f'B{row}'] = customer_name
        ws[f'C{row}'] = f'₦{amount:,.2f}'
        ws[f'D{row}'] = f'₦{admin_fee:,.2f}'
        ws[f'E{row}'] = f'₦{insurance:,.2f}'
        ws[f'F{row}'] = f'₦{form:,.2f}'
        ws[f'G{row}'] = f'₦{credit:,.2f}'
        ws[f'H{row}'] = f'₦{bvn:,.2f}'
        ws[f'I{row}'] = f'₦{total:,.2f}'
        
        grand_total += total
        row += 1
    
    row += 1
    ws[f'H{row}'] = 'TOTAL'
    ws[f'H{row}'].font = Font(bold=True)
    ws[f'I{row}'] = f'₦{grand_total:,.2f}'
    ws[f'I{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']:
        ws.column_dimensions[col].width = 14
    
    return create_download_response(wb, "Upfront")

def generate_loan_disbursement(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Loan Disbursements"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Disbursements"
    
    ws['A1'] = 'PRIMA - LOAN DISBURSEMENTS'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Date', 'Loan ID', 'Customer', 'Product', 'Amount', 'Tenure', 'Rate']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    loans_query = db.query(LoanApplication).filter(LoanApplication.status == "disbursed")
    if start_date:
        loans_query = loans_query.filter(LoanApplication.created_at >= start_date)
    if end_date:
        loans_query = loans_query.filter(LoanApplication.created_at <= end_date)
    
    loans = loans_query.order_by(LoanApplication.created_at.desc()).all()
    
    row = 4
    total = 0
    
    for loan in loans:
        customer = db.query(User).filter(User.id == loan.customer_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
        
        product = db.query(LoanProduct).filter(LoanProduct.id == loan.loan_product_id).first()
        product_name = product.name if product else "N/A"
        
        amount = loan.approved_amount or loan.requested_amount
        
        ws[f'A{row}'] = loan.created_at.strftime("%Y-%m-%d") if loan.created_at else "N/A"
        ws[f'B{row}'] = loan.application_number
        ws[f'C{row}'] = customer_name
        ws[f'D{row}'] = product_name
        ws[f'E{row}'] = f'₦{amount:,.2f}'
        ws[f'F{row}'] = f'{loan.tenure_months}m'
        ws[f'G{row}'] = f'{loan.interest_rate}%'
        
        total += amount
        row += 1
    
    row += 1
    ws[f'D{row}'] = 'TOTAL'
    ws[f'D{row}'].font = Font(bold=True)
    ws[f'E{row}'] = f'₦{total:,.2f}'
    ws[f'E{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E', 'F', 'G']:
        ws.column_dimensions[col].width = 16
    
    return create_download_response(wb, "Disbursements")

def generate_fixed_deposit_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Fixed Deposits"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Fixed Deposits"
    
    ws['A1'] = 'PRIMA - FIXED DEPOSITS'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Customer', 'Amount', 'Rate', 'Start', 'Maturity']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    deposits_query = db.query(FixedDeposit)
    if start_date:
        deposits_query = deposits_query.filter(FixedDeposit.start_date >= start_date)
    if end_date:
        deposits_query = deposits_query.filter(FixedDeposit.start_date <= end_date)
    
    deposits = deposits_query.all()
    
    row = 4
    total = 0
    
    for deposit in deposits:
        customer = db.query(User).filter(User.id == deposit.customer_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
        
        ws[f'A{row}'] = customer_name
        ws[f'B{row}'] = f'₦{deposit.amount:,.2f}'
        ws[f'C{row}'] = f'{deposit.interest_rate}%'
        ws[f'D{row}'] = deposit.start_date.strftime("%Y-%m-%d") if deposit.start_date else "N/A"
        ws[f'E{row}'] = deposit.maturity_date.strftime("%Y-%m-%d") if deposit.maturity_date else "N/A"
        
        total += deposit.amount
        row += 1
    
    row += 1
    ws[f'A{row}'] = 'TOTAL'
    ws[f'A{row}'].font = Font(bold=True)
    ws[f'B{row}'] = f'₦{total:,.2f}'
    ws[f'B{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E']:
        ws.column_dimensions[col].width = 20
    
    return create_download_response(wb, "Fixed_Deposits")

def generate_fixed_assets_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Fixed Assets"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Fixed Assets"
    
    ws['A1'] = 'PRIMA - FIXED ASSETS'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Asset', 'Category', 'Date', 'Cost', 'Depreciation', 'Net Value']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    assets = [
        {"name": "Office Building", "category": "Property", "date": "2020-01-01", "cost": 50000000, "depreciation": 5000000},
        {"name": "Furniture", "category": "Equipment", "date": "2021-06-01", "cost": 2000000, "depreciation": 400000},
        {"name": "Computers", "category": "Equipment", "date": "2022-01-01", "cost": 3000000, "depreciation": 1000000},
    ]
    
    row = 4
    total_cost = 0
    total_depreciation = 0
    
    for asset in assets:
        net = asset["cost"] - asset["depreciation"]
        
        ws[f'A{row}'] = asset["name"]
        ws[f'B{row}'] = asset["category"]
        ws[f'C{row}'] = asset["date"]
        ws[f'D{row}'] = f'₦{asset["cost"]:,.2f}'
        ws[f'E{row}'] = f'₦{asset["depreciation"]:,.2f}'
        ws[f'F{row}'] = f'₦{net:,.2f}'
        
        total_cost += asset["cost"]
        total_depreciation += asset["depreciation"]
        row += 1
    
    row += 1
    ws[f'C{row}'] = 'TOTALS'
    ws[f'C{row}'].font = Font(bold=True)
    ws[f'D{row}'] = f'₦{total_cost:,.2f}'
    ws[f'D{row}'].font = Font(bold=True)
    ws[f'E{row}'] = f'₦{total_depreciation:,.2f}'
    ws[f'E{row}'].font = Font(bold=True)
    ws[f'F{row}'] = f'₦{(total_cost - total_depreciation):,.2f}'
    ws[f'F{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E', 'F']:
        ws.column_dimensions[col].width = 18
    
    return create_download_response(wb, "Fixed_Assets")

def generate_savings_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Savings"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Savings"
    
    ws['A1'] = 'PRIMA - SAVINGS ACCOUNTS'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Customer', 'Account', 'Balance', 'Last Update']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    savings = db.query(Savings).all()
    
    row = 4
    total = 0
    
    for saving in savings:
        customer = db.query(User).filter(User.id == saving.user_id).first()
        customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
        
        ws[f'A{row}'] = customer_name
        ws[f'B{row}'] = saving.account_number or "N/A"
        ws[f'C{row}'] = f'₦{saving.balance:,.2f}'
        ws[f'D{row}'] = saving.updated_at.strftime("%Y-%m-%d") if saving.updated_at else "N/A"
        
        total += saving.balance
        row += 1
    
    row += 1
    ws[f'B{row}'] = 'TOTAL'
    ws[f'B{row}'].font = Font(bold=True)
    ws[f'C{row}'] = f'₦{total:,.2f}'
    ws[f'C{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D']:
        ws.column_dimensions[col].width = 20
    
    return create_download_response(wb, "Savings")

def generate_shares_report(db: Session, start_date: Optional[str], end_date: Optional[str]):
    """Shares"""
    wb = Workbook()
    ws = wb.active
    ws.title = "Shares"
    
    ws['A1'] = 'PRIMA - SCHEDULE OF SHARES'
    ws['A1'].font = Font(bold=True, size=14)
    
    headers = ['Shareholder', 'Shares', 'Value', 'Capital', '%']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    
    shareholders = db.query(Shareholder).all()
    total_capital = db.query(func.sum(Shareholder.capital)).scalar() or 1
    
    row = 4
    grand_total = 0
    
    for shareholder in shareholders:
        percentage = (shareholder.capital / total_capital) * 100
        value = shareholder.capital / (shareholder.shares or 1)
        
        ws[f'A{row}'] = shareholder.name
        ws[f'B{row}'] = shareholder.shares or 0
        ws[f'C{row}'] = f'₦{value:,.2f}'
        ws[f'D{row}'] = f'₦{shareholder.capital:,.2f}'
        ws[f'E{row}'] = f'{percentage:.2f}%'
        
        grand_total += shareholder.capital
        row += 1
    
    row += 1
    ws[f'C{row}'] = 'TOTAL'
    ws[f'C{row}'].font = Font(bold=True)
    ws[f'D{row}'] = f'₦{grand_total:,.2f}'
    ws[f'D{row}'].font = Font(bold=True)
    ws[f'E{row}'] = '100%'
    ws[f'E{row}'].font = Font(bold=True)
    
    for col in ['A', 'B', 'C', 'D', 'E']:
        ws.column_dimensions[col].width = 18
    
    return create_download_response(wb, "Shares")