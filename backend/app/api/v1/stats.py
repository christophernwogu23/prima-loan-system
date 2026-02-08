from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.api.deps import get_db, get_current_user
from app.models import User
from app.models.loan_application import LoanApplication
from app.models.loan_product import LoanProduct
from app.models.savings import Savings
from app.models.expense import Expense
from app.models.fixed_deposit import FixedDeposit
from app.models.shareholder import Shareholder
from app.models.payment import Payment
from fastapi.responses import StreamingResponse
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from typing import Optional


router = APIRouter(prefix="/stats", tags=["Statistics"])

@router.get("/dashboard")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auto-generate payment reminders
    try:
        from app.utils.payment_scheduler import generate_payment_reminders
        generate_payment_reminders(db)
    except Exception as e:
        print(f"Error generating payment reminders: {e}")
    
    stats = {}
    today = datetime.now()
    thirty_days_ago = today - timedelta(days=30)
    
    if current_user.role == "customer":
        # Customer stats
        my_applications = db.query(LoanApplication).filter(
            LoanApplication.customer_id == current_user.id
        ).all()
        
        my_savings = db.query(Savings).filter(Savings.user_id == current_user.id).first()
        
        # Get recent payments
        my_loan_ids = [a.id for a in my_applications]
        my_payments = db.query(Payment).filter(
            Payment.loan_application_id.in_(my_loan_ids)
        ).order_by(Payment.payment_date.desc()).limit(5).all()
        
        active_loans = [a for a in my_applications if a.status == "disbursed"]
        total_outstanding = sum(a.approved_amount or a.requested_amount for a in active_loans)
        total_paid = sum(p.amount for p in db.query(Payment).filter(Payment.loan_application_id.in_(my_loan_ids)).all())
        
        stats = {
            "savings_balance": my_savings.balance if my_savings else 0,
            "total_applications": len(my_applications),
            "pending_applications": len([a for a in my_applications if a.status in ["submitted", "officer_approved", "manager_approved"]]),
            "active_loans": len(active_loans),
            "total_outstanding": total_outstanding,
            "total_paid": total_paid,
            "recent_payments": [
                {
                    "amount": p.amount,
                    "date": p.payment_date.isoformat() if p.payment_date else None,
                    "method": p.payment_method
                } for p in my_payments
            ],
            "applications_summary": {
                "submitted": len([a for a in my_applications if a.status == "submitted"]),
                "in_progress": len([a for a in my_applications if a.status in ["officer_approved", "manager_approved"]]),
                "disbursed": len([a for a in my_applications if a.status == "disbursed"]),
                "rejected": len([a for a in my_applications if a.status == "rejected"]),
            }
        }
    
    elif current_user.role == "loan_officer":
        # Officer stats
        my_customers = db.query(User).filter(
            User.assigned_officer_id == current_user.id,
            User.role == "customer"
        ).all()
        
        assigned_apps = db.query(LoanApplication).filter(
            LoanApplication.assigned_officer_id == current_user.id
        ).all()
        
        pending_review = db.query(LoanApplication).filter(
            LoanApplication.status == "submitted",
            LoanApplication.assigned_officer_id == current_user.id
        ).all()
        
        # Recent applications from my customers
        customer_ids = [c.id for c in my_customers]
        recent_apps = db.query(LoanApplication).filter(
            LoanApplication.customer_id.in_(customer_ids)
        ).order_by(LoanApplication.created_at.desc()).limit(5).all()
        
        stats = {
            "total_customers": len(my_customers),
            "assigned_applications": len(assigned_apps),
            "pending_my_review": len(pending_review),
            "approved_by_me": len([a for a in assigned_apps if a.status in ["officer_approved", "manager_approved", "disbursed"]]),
            "rejected_by_me": len([a for a in assigned_apps if a.status == "officer_rejected"]),
            "disbursed_total": sum(a.approved_amount or a.requested_amount for a in assigned_apps if a.status == "disbursed"),
            "recent_applications": [
                {
                    "id": a.id,
                    "application_number": a.application_number,
                    "customer_id": a.customer_id,
                    "amount": a.requested_amount,
                    "status": a.status,
                    "date": a.created_at.isoformat() if a.created_at else None
                } for a in recent_apps
            ],
            "applications_by_status": {
                "submitted": len([a for a in assigned_apps if a.status == "submitted"]),
                "officer_approved": len([a for a in assigned_apps if a.status == "officer_approved"]),
                "officer_rejected": len([a for a in assigned_apps if a.status == "officer_rejected"]),
                "manager_approved": len([a for a in assigned_apps if a.status == "manager_approved"]),
                "disbursed": len([a for a in assigned_apps if a.status == "disbursed"]),
                "rejected": len([a for a in assigned_apps if a.status == "rejected"]),
            }
        }
    
    elif current_user.role == "manager":
        # Manager stats
        all_applications = db.query(LoanApplication).all()
        
        # Pending manager review (officer approved or rejected)
        pending_my_review = [a for a in all_applications if a.status in ["officer_approved", "officer_rejected"]]
        
        # This month's activity
        this_month_apps = [a for a in all_applications if a.created_at and a.created_at >= thirty_days_ago]
        
        stats = {
            "total_applications": len(all_applications),
            "pending_my_review": len(pending_my_review),
            "approved_by_me": len([a for a in all_applications if a.status in ["manager_approved", "disbursed"]]),
            "rejected_total": len([a for a in all_applications if a.status == "rejected"]),
            "this_month_applications": len(this_month_apps),
            "this_month_amount": sum(a.requested_amount for a in this_month_apps),
            "total_disbursed_amount": sum(a.approved_amount or a.requested_amount for a in all_applications if a.status == "disbursed"),
            "applications_by_status": {
                "submitted": len([a for a in all_applications if a.status == "submitted"]),
                "officer_approved": len([a for a in all_applications if a.status == "officer_approved"]),
                "officer_rejected": len([a for a in all_applications if a.status == "officer_rejected"]),
                "manager_approved": len([a for a in all_applications if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_applications if a.status == "disbursed"]),
                "rejected": len([a for a in all_applications if a.status == "rejected"]),
            },
            "pending_applications": [
                {
                    "id": a.id,
                    "application_number": a.application_number,
                    "amount": a.requested_amount,
                    "status": a.status,
                    "date": a.created_at.isoformat() if a.created_at else None
                } for a in pending_my_review[:5]
            ]
        }
    
    elif current_user.role == "ceo":
        # CEO stats - SAFE VERSION
        all_applications = db.query(LoanApplication).all()
        all_users = db.query(User).all()
        
        # Pending CEO review
        pending_my_review = [a for a in all_applications if a.status == "manager_approved"]
        
        # Financial summary
        disbursed_applications = [a for a in all_applications if a.status == "disbursed"]
        total_disbursed = sum(a.approved_amount or a.requested_amount for a in disbursed_applications)
        
        # Calculate total paid from all payments
        all_payments = db.query(Payment).all()
        total_paid = sum(p.amount for p in all_payments)
        
        # Remaining balance (outstanding)
        remaining_balance = total_disbursed - total_paid
        
        # Simple growth calculation (default to 0 for now)
        disbursed_growth = 0
        paid_growth = 0
        balance_growth = 0
        
        # Get recent applications - SIMPLIFIED
        recent_apps = db.query(LoanApplication).order_by(
            LoanApplication.created_at.desc()
        ).limit(10).all()
        
        recent_applications_list = []
        for app in recent_apps:
            try:
                # Safely get customer
                customer = db.query(User).filter(User.id == app.customer_id).first()
                customer_name = f"{customer.first_name} {customer.last_name}" if customer else "N/A"
                
                # Safely get product
                product = db.query(LoanProduct).filter(LoanProduct.id == app.loan_product_id).first()
                product_name = product.name if product else "N/A"
                
                recent_applications_list.append({
                    "id": app.id,
                    "application_number": app.application_number,
                    "customer_name": customer_name,
                    "product_name": product_name,
                    "amount": float(app.requested_amount),
                    "status": app.status,
                    "created_at": app.created_at.isoformat() if app.created_at else None
                })
            except Exception as e:
                print(f"Error processing app {app.id}: {e}")
                continue
        
        total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
        total_fixed_deposits = db.query(func.sum(FixedDeposit.amount)).scalar() or 0
        total_shareholders = db.query(func.sum(Shareholder.capital)).scalar() or 0
        total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0
        
        # Active loans
        active_loans = [a for a in all_applications if a.status == "disbursed"]
        
        # Defaults
        defaults_count = 0
        for loan in active_loans:
            try:
                last_payment = db.query(Payment).filter(
                    Payment.loan_application_id == loan.id
                ).order_by(Payment.payment_date.desc()).first()
                
                if last_payment:
                    days_since = (datetime.now() - last_payment.payment_date).days
                else:
                    days_since = (datetime.now() - loan.created_at).days if loan.created_at else 0
                
                if days_since > 30:
                    defaults_count += 1
            except:
                continue
        
        stats = {
            "pending_my_review": len(pending_my_review),
            "total_applications": len(all_applications),
            "total_disbursed": total_disbursed,
            "total_paid": total_paid,
            "remaining_balance": remaining_balance,
            "disbursed_growth": disbursed_growth,
            "paid_growth": paid_growth,
            "balance_growth": balance_growth,
            "active_loans": len(active_loans),
            "total_customers": len([u for u in all_users if u.role == "customer"]),
            "total_staff": len([u for u in all_users if u.role != "customer"]),
            "total_savings": total_savings,
            "total_fixed_deposits": total_fixed_deposits,
            "shareholder_capital": total_shareholders,
            "total_expenses": total_expenses,
            "defaults_count": defaults_count,
            "applications_by_status": {
                "submitted": len([a for a in all_applications if a.status == "submitted"]),
                "officer_approved": len([a for a in all_applications if a.status == "officer_approved"]),
                "manager_approved": len([a for a in all_applications if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_applications if a.status == "disbursed"]),
                "rejected": len([a for a in all_applications if a.status == "rejected"]),
            },
            "recent_applications": recent_applications_list,
            "pending_applications": [
                {
                    "id": a.id,
                    "application_number": a.application_number,
                    "amount": a.requested_amount,
                    "status": a.status,
                    "date": a.created_at.isoformat() if a.created_at else None
                } for a in pending_my_review[:5]
            ]
        }
    
    elif current_user.role == "admin":
        # Admin stats - system overview
        all_applications = db.query(LoanApplication).all()
        all_users = db.query(User).all()
        all_products = db.query(LoanProduct).filter(LoanProduct.is_active == True).all()
        
        total_disbursed = sum(a.approved_amount or a.requested_amount for a in all_applications if a.status == "disbursed")
        total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
        total_fixed_deposits = db.query(func.sum(FixedDeposit.amount)).scalar() or 0
        total_shareholders = db.query(func.sum(Shareholder.capital)).scalar() or 0
        total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0
        
        # Users by role
        users_by_role = {}
        for user in all_users:
            users_by_role[user.role] = users_by_role.get(user.role, 0) + 1
        
        stats = {
            "total_users": len(all_users),
            "users_by_role": users_by_role,
            "total_customers": len([u for u in all_users if u.role == "customer"]),
            "active_products": len(all_products),
            "total_applications": len(all_applications),
            "total_disbursed": total_disbursed,
            "total_savings": total_savings,
            "total_fixed_deposits": total_fixed_deposits,
            "shareholder_capital": total_shareholders,
            "total_expenses": total_expenses,
            "applications_by_status": {
                "submitted": len([a for a in all_applications if a.status == "submitted"]),
                "officer_approved": len([a for a in all_applications if a.status == "officer_approved"]),
                "officer_rejected": len([a for a in all_applications if a.status == "officer_rejected"]),
                "manager_approved": len([a for a in all_applications if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_applications if a.status == "disbursed"]),
                "rejected": len([a for a in all_applications if a.status == "rejected"]),
            },
            "recent_applications": [
                {
                    "id": a.id,
                    "application_number": a.application_number,
                    "amount": a.requested_amount,
                    "status": a.status,
                    "date": a.created_at.isoformat() if a.created_at else None
                } for a in sorted(all_applications, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]
            ]
        }
    
    return stats
        

@router.get("/reports")
async def get_reports(
    filter: str = "month",
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive reports with filters"""
    
    # Get all applications
    all_applications = db.query(LoanApplication).all()
    
    # Filter by date based on filter type
    now = datetime.now()
    if filter == "day":
        start_date = now - timedelta(days=1)
        filter_label = "Last 24 Hours"
    elif filter == "week":
        start_date = now - timedelta(days=7)
        filter_label = "Last 7 Days"
    elif filter == "month":
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"
    elif filter == "year":
        start_date = now - timedelta(days=365)
        filter_label = "Last Year"
    elif filter == "custom_month" and month:
        # Parse YYYY-MM format
        year, month_num = map(int, month.split('-'))
        start_date = datetime(year, month_num, 1)
        # Get last day of month
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month_num + 1, 1) - timedelta(days=1)
        filtered_applications = [app for app in all_applications if start_date <= app.created_at <= end_date]
        filter_label = f"{start_date.strftime('%B %Y')}"
    else:
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"
    
    if filter != "custom_month":
        filtered_applications = [app for app in all_applications if app.created_at >= start_date]
    
    # Calculate period stats
    period_applications = len(filtered_applications)
    period_total_amount = sum(app.requested_amount for app in filtered_applications if app.requested_amount)
    period_approved_count = len([app for app in filtered_applications if app.status == "approved"])
    
    # Applications by Status (All Time)
    status_counts = {}
    for app in all_applications:
        status_counts[app.status] = status_counts.get(app.status, 0) + 1
    
    applications_by_status = [
        {"name": status, "value": count}
        for status, count in status_counts.items()
    ]
    
    # Applications by Product (All Time)
    all_products = db.query(LoanProduct).all()
    product_names = {p.id: p.name for p in all_products}
    product_data = {}
    
    for app in all_applications:
        product_name = product_names.get(app.loan_product_id, "Unknown")
        if product_name not in product_data:
            product_data[product_name] = {"applications": 0, "amount": 0}
        product_data[product_name]["applications"] += 1
        product_data[product_name]["amount"] += app.requested_amount
    
    applications_by_product = [
        {"name": name, "applications": data["applications"], "amount": data["amount"]}
        for name, data in product_data.items()
    ]
    
    # Monthly Trend
    monthly_data = {}
    for app in filtered_applications:
        if app.created_at:
            if filter in ["day", "week"]:
                time_key = app.created_at.strftime("%Y-%m-%d")
                display_key = app.created_at.strftime("%b %d")
            else:
                time_key = app.created_at.strftime("%Y-%m")
                display_key = app.created_at.strftime("%b %Y")
            
            if time_key not in monthly_data:
                monthly_data[time_key] = {"month": display_key, "applications": 0}
            monthly_data[time_key]["applications"] += 1
    
    monthly_trend = [monthly_data[key] for key in sorted(monthly_data.keys())]
    
    # Calculate Active vs Defaults
    disbursed_loans = [app for app in all_applications if app.status == "disbursed"]
    active_count = 0
    defaults_count = 0
    
    for loan in disbursed_loans:
        # Check last payment date
        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()
        
        if last_payment:
            days_since = (datetime.now() - last_payment.payment_date).days
        else:
            days_since = (datetime.now() - loan.created_at).days if loan.created_at else 0
        
        if days_since > 30:
            defaults_count += 1
        else:
            active_count += 1
    
    active_vs_defaults = [
        {"name": "Active Payments", "value": active_count},
        {"name": "Defaults", "value": defaults_count}
    ]
    
    return {
        "applications_by_status": applications_by_status,
        "applications_by_product": applications_by_product,
        "monthly_trend": monthly_trend,
        "active_vs_defaults": active_vs_defaults,
        "filter": filter,
        "filter_label": filter_label,
        "start_date": start_date.isoformat(),
        "total_applications": len(all_applications),
        "period_applications": period_applications,
        "period_total_amount": period_total_amount,
        "period_approved_count": period_approved_count
    }

@router.get("/reports/export")
async def export_reports(
    filter: str = Query("month", regex="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only management can export reports
    if current_user.role not in ["manager", "ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate date range based on filter
    now = datetime.now()
    if filter == "day":
        start_date = now - timedelta(hours=24)
        filter_label = "Last 24 Hours"
    elif filter == "week":
        start_date = now - timedelta(days=7)
        filter_label = "Last 7 Days"
    elif filter == "month":
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"
    elif filter == "year":
        start_date = now - timedelta(days=365)
        filter_label = "Last Year"
    else:
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"
    
    # Get data
    all_applications = db.query(LoanApplication).all()
    filtered_applications = db.query(LoanApplication).filter(
        LoanApplication.created_at >= start_date
    ).all()
    all_products = db.query(LoanProduct).all()
    
    # Create workbook
    wb = Workbook()
    
    # === Summary Sheet ===
    ws_summary = wb.active
    ws_summary.title = "Summary"
    
    # Header styling
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=12)
    
    # Title
    ws_summary['A1'] = 'LOAN MANAGEMENT SYSTEM - ANALYTICS REPORT'
    ws_summary['A1'].font = Font(bold=True, size=14)
    ws_summary['A2'] = f'Generated: {now.strftime("%Y-%m-%d %H:%M:%S")}'
    ws_summary['A3'] = f'Period: {filter_label}'
    
    # Overall metrics
    ws_summary['A5'] = 'OVERALL METRICS'
    ws_summary['A5'].font = header_font
    ws_summary['A5'].fill = header_fill
    ws_summary['B5'].fill = header_fill
    
    ws_summary['A6'] = 'Total Applications (All Time)'
    ws_summary['B6'] = len(all_applications)
    
    ws_summary['A7'] = f'Applications ({filter_label})'
    ws_summary['B7'] = len(filtered_applications)
    
    period_total_amount = sum(app.requested_amount for app in filtered_applications)
    ws_summary['A8'] = f'Amount Requested ({filter_label})'
    ws_summary['B8'] = f'₦{period_total_amount:,.2f}'
    
    period_approved_count = len([app for app in filtered_applications if app.status in ["manager_approved", "disbursed"]])
    ws_summary['A9'] = f'Approved ({filter_label})'
    ws_summary['B9'] = period_approved_count
    
    total_disbursed = sum(app.approved_amount or app.requested_amount for app in all_applications if app.status == "disbursed")
    ws_summary['A10'] = 'Total Disbursed (All Time)'
    ws_summary['B10'] = f'₦{total_disbursed:,.2f}'
    
    # Adjust column width
    ws_summary.column_dimensions['A'].width = 35
    ws_summary.column_dimensions['B'].width = 20
    
    # === Applications by Status Sheet ===
    ws_status = wb.create_sheet("Applications by Status")
    ws_status['A1'] = 'Status'
    ws_status['B1'] = 'Count'
    ws_status['A1'].font = header_font
    ws_status['B1'].font = header_font
    ws_status['A1'].fill = header_fill
    ws_status['B1'].fill = header_fill
    
    status_counts = {}
    for app in all_applications:
        status_counts[app.status] = status_counts.get(app.status, 0) + 1
    
    row = 2
    for status, count in status_counts.items():
        ws_status[f'A{row}'] = status
        ws_status[f'B{row}'] = count
        row += 1
    
    ws_status.column_dimensions['A'].width = 20
    ws_status.column_dimensions['B'].width = 15
    
    # === Applications by Product Sheet ===
    ws_product = wb.create_sheet("Applications by Product")
    ws_product['A1'] = 'Product'
    ws_product['B1'] = 'Applications'
    ws_product['C1'] = 'Total Amount'
    for col in ['A1', 'B1', 'C1']:
        ws_product[col].font = header_font
        ws_product[col].fill = header_fill
    
    product_names = {p.id: p.name for p in all_products}
    product_counts = {}
    product_amounts = {}
    
    for app in all_applications:
        product_name = product_names.get(app.loan_product_id, "Unknown")
        product_counts[product_name] = product_counts.get(product_name, 0) + 1
        product_amounts[product_name] = product_amounts.get(product_name, 0) + app.requested_amount
    
    row = 2
    for name in product_counts.keys():
        ws_product[f'A{row}'] = name
        ws_product[f'B{row}'] = product_counts[name]
        ws_product[f'C{row}'] = f'₦{product_amounts[name]:,.2f}'
        row += 1
    
    ws_product.column_dimensions['A'].width = 25
    ws_product.column_dimensions['B'].width = 15
    ws_product.column_dimensions['C'].width = 20
    
    # === Trend Data Sheet ===
    ws_trend = wb.create_sheet("Trend Data")
    ws_trend['A1'] = 'Period'
    ws_trend['B1'] = 'Applications'
    ws_trend['C1'] = 'Amount'
    for col in ['A1', 'B1', 'C1']:
        ws_trend[col].font = header_font
        ws_trend[col].fill = header_fill
    
    monthly_data = {}
    for app in filtered_applications:
        if app.created_at:
            if filter in ["day", "week"]:
                time_key = app.created_at.strftime("%Y-%m-%d")
                display_key = app.created_at.strftime("%b %d, %Y")
            else:
                time_key = app.created_at.strftime("%Y-%m")
                display_key = app.created_at.strftime("%b %Y")
            
            if time_key not in monthly_data:
                monthly_data[time_key] = {"period": display_key, "applications": 0, "amount": 0}
            monthly_data[time_key]["applications"] += 1
            monthly_data[time_key]["amount"] += app.requested_amount
    
    row = 2
    for time_key in sorted(monthly_data.keys()):
        data = monthly_data[time_key]
        ws_trend[f'A{row}'] = data["period"]
        ws_trend[f'B{row}'] = data["applications"]
        ws_trend[f'C{row}'] = f'₦{data["amount"]:,.2f}'
        row += 1
    
    ws_trend.column_dimensions['A'].width = 20
    ws_trend.column_dimensions['B'].width = 15
    ws_trend.column_dimensions['C'].width = 20
    
    # Save to BytesIO
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    # Generate filename
    filename = f'PRIMA_Analytics_Report_{filter_label.replace(" ", "_")}_{now.strftime("%Y%m%d_%H%M%S")}.xlsx'
    
    return StreamingResponse(
        excel_file,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@router.get("/loan-officers-performance")
async def get_loan_officers_performance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get performance metrics for all loan officers"""
    
    # Base query for loan officers
    officers_query = db.query(User).filter(User.role == "loan_officer")
    officers = officers_query.all()
    
    performance_data = []
    
    for officer in officers:
        # Get all applications assigned to this officer
        apps_query = db.query(LoanApplication).filter(
            LoanApplication.loan_officer_id == officer.id
        )
        
        # Apply date filter if provided
        if start_date:
            apps_query = apps_query.filter(LoanApplication.created_at >= start_date)
        if end_date:
            apps_query = apps_query.filter(LoanApplication.created_at <= end_date)
        
        applications = apps_query.all()
        total_apps = len(applications)
        
        if total_apps == 0:
            continue
        
        # Calculate metrics
        approved_apps = [app for app in applications if app.ceo_status == "approved"]
        disbursed_apps = [app for app in applications if app.disbursed]
        rejected_apps = [app for app in applications if 
                        app.loan_officer_status == "rejected" or 
                        app.manager_status == "rejected" or 
                        app.ceo_status == "rejected"]
        
        # Calculate financial metrics
        total_disbursed = sum(app.approved_amount or 0 for app in disbursed_apps)
        total_outstanding = 0
        total_collected = 0
        
        for app in disbursed_apps:
            payments = db.query(Payment).filter(Payment.loan_application_id == app.id).all()
            total_paid = sum(p.amount for p in payments)
            total_collected += total_paid
            outstanding = (app.approved_amount or 0) - total_paid
            total_outstanding += outstanding
        
       # Calculate defaults (loans with no payment in 30+ days)
        defaults = 0
        for app in disbursed_apps:
            last_payment = db.query(Payment).filter(
                Payment.loan_application_id == app.id
            ).order_by(Payment.payment_date.desc()).first()
            
            if last_payment:
                days_since = (datetime.now() - last_payment.payment_date).days
            else:
                days_since = (datetime.now() - app.created_at).days if app.created_at else 0
            
            if days_since > 30:
                defaults += 1
        
        # Calculate average processing time (from application to CEO approval)
        processing_times = []
        for app in approved_apps:
            if app.ceo_approved_at and app.created_at:
                delta = app.ceo_approved_at - app.created_at
                processing_times.append(delta.days)
        
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
        
        performance_data.append({
            "officer_id": officer.id,
            "officer_name": officer.full_name,
            "total_applications": total_apps,
            "approved_applications": len(approved_apps),
            "rejected_applications": len(rejected_apps),
            "disbursed_applications": len(disbursed_apps),
            "approval_rate": (len(approved_apps) / total_apps * 100) if total_apps > 0 else 0,
            "total_disbursed": total_disbursed,
            "total_collected": total_collected,
            "total_outstanding": total_outstanding,
            "defaults_count": defaults,
            "default_rate": (defaults / len(disbursed_apps) * 100) if len(disbursed_apps) > 0 else 0,
            "avg_processing_days": round(avg_processing_time, 1)
        })
    
    return performance_data

@router.get("/revenue-vs-expenses")
async def get_revenue_vs_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get revenue vs expenses analysis"""
    
    # Base queries
    payments_query = db.query(Payment)
    expenses_query = db.query(Expense)
    
    # Apply date filters
    if start_date:
        payments_query = payments_query.filter(Payment.payment_date >= start_date)
        expenses_query = expenses_query.filter(Expense.expense_date >= start_date)
    if end_date:
        payments_query = payments_query.filter(Payment.payment_date <= end_date)
        expenses_query = expenses_query.filter(Expense.expense_date <= end_date)
    
    payments = payments_query.all()
    expenses = expenses_query.all()
    
    # Calculate revenue (loan repayments)
    total_revenue = sum(p.amount for p in payments)
    
    # Calculate total expenses
    total_expenses = sum(e.amount for e in expenses)
    
    # Net profit
    net_profit = total_revenue - total_expenses
    
    # Monthly breakdown
    from collections import defaultdict
    monthly_data = defaultdict(lambda: {"revenue": 0, "expenses": 0})
    
    for payment in payments:
        month_key = payment.payment_date.strftime("%Y-%m")
        monthly_data[month_key]["revenue"] += payment.amount
    
    for expense in expenses:
        month_key = expense.expense_date.strftime("%Y-%m")
        monthly_data[month_key]["expenses"] += expense.amount
    
    # Convert to sorted list
    monthly_breakdown = []
    for month, data in sorted(monthly_data.items()):
        monthly_breakdown.append({
            "month": month,
            "revenue": data["revenue"],
            "expenses": data["expenses"],
            "net_profit": data["revenue"] - data["expenses"]
        })
    
    # Calculate interest income (estimated from loan products)
    interest_income = 0
    disbursed_loans = db.query(LoanApplication).filter(LoanApplication.disbursed == True)
    
    if start_date:
        disbursed_loans = disbursed_loans.filter(LoanApplication.disbursed_at >= start_date)
    if end_date:
        disbursed_loans = disbursed_loans.filter(LoanApplication.disbursed_at <= end_date)
    
    for loan in disbursed_loans.all():
        if loan.loan_product and loan.approved_amount:
            interest = (loan.approved_amount * loan.loan_product.interest_rate / 100)
            interest_income += interest
    
    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "estimated_interest_income": interest_income,
            "profit_margin": (net_profit / total_revenue * 100) if total_revenue > 0 else 0
        },
        "monthly_breakdown": monthly_breakdown,
        "expense_categories": _get_expense_breakdown(expenses),
        "revenue_sources": {
            "loan_repayments": total_revenue,
            "interest_income": interest_income
        }
    }

def _get_expense_breakdown(expenses):
    """Helper function to categorize expenses"""
    from collections import defaultdict
    categories = defaultdict(float)
    
    for expense in expenses:
        categories[expense.category] += expense.amount
    
    return [{"category": k, "amount": v} for k, v in categories.items()]