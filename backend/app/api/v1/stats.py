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
from openpyxl.styles import Font, PatternFill
from typing import Optional
from collections import defaultdict

router = APIRouter(prefix="/stats", tags=["Statistics"])


def calc_loan_total(loan):
    """Principal + flat rate interest"""
    principal = loan.approved_amount or loan.requested_amount or 0
    rate = loan.interest_rate or 0
    return principal * (1 + rate / 100)


def get_loan_remaining(loan, db):
    """Total owed minus total paid"""
    total_owed = calc_loan_total(loan)
    total_paid = db.query(func.sum(Payment.amount)).filter(
        Payment.loan_application_id == loan.id
    ).scalar() or 0
    return total_owed - total_paid


@router.get("/dashboard")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        from app.utils.payment_scheduler import generate_payment_reminders
        generate_payment_reminders(db)
    except Exception as e:
        print(f"Error generating payment reminders: {e}")

    today = datetime.now()
    thirty_days_ago = today - timedelta(days=30)

    # ===== CUSTOMER =====
    if current_user.role == "customer":
        my_apps = db.query(LoanApplication).filter(
            LoanApplication.customer_id == current_user.id
        ).all()

        my_savings = db.query(Savings).filter(Savings.user_id == current_user.id).first()
        my_loan_ids = [a.id for a in my_apps]

        recent_payments = db.query(Payment).filter(
            Payment.loan_application_id.in_(my_loan_ids)
        ).order_by(Payment.payment_date.desc()).limit(5).all()

        active_loans = [a for a in my_apps if a.status == "disbursed"]

        # Outstanding = sum of (principal + interest) for active loans
        total_outstanding = sum(calc_loan_total(a) for a in active_loans)

        total_paid = db.query(func.sum(Payment.amount)).filter(
            Payment.loan_application_id.in_(my_loan_ids)
        ).scalar() or 0

        return {
            "savings_balance": my_savings.balance if my_savings else 0,
            "total_applications": len(my_apps),
            "pending_applications": len([a for a in my_apps if a.status in ["submitted", "officer_approved", "manager_approved"]]),
            "active_loans": len(active_loans),
            "total_outstanding": total_outstanding,
            "total_paid": total_paid,
            "recent_payments": [
                {"amount": p.amount, "date": p.payment_date.isoformat() if p.payment_date else None, "method": p.payment_method}
                for p in recent_payments
            ],
            "applications_summary": {
                "submitted": len([a for a in my_apps if a.status == "submitted"]),
                "in_progress": len([a for a in my_apps if a.status in ["officer_approved", "manager_approved"]]),
                "disbursed": len([a for a in my_apps if a.status == "disbursed"]),
                "rejected": len([a for a in my_apps if a.status == "rejected"]),
            }
        }

    # ===== LOAN OFFICER =====
    elif current_user.role == "loan_officer":
        my_customers = db.query(User).filter(
            User.assigned_officer_id == current_user.id,
            User.role == "customer"
        ).all()

        assigned_apps = db.query(LoanApplication).filter(
            LoanApplication.assigned_officer_id == current_user.id
        ).all()

        pending_review = [a for a in assigned_apps if a.status == "submitted"]

        customer_ids = [c.id for c in my_customers]
        recent_apps = db.query(LoanApplication).filter(
            LoanApplication.customer_id.in_(customer_ids)
        ).order_by(LoanApplication.created_at.desc()).limit(5).all()

        disbursed_apps = [a for a in assigned_apps if a.status == "disbursed"]
        disbursed_total = sum(calc_loan_total(a) for a in disbursed_apps)

        return {
            "total_customers": len(my_customers),
            "assigned_applications": len(assigned_apps),
            "pending_my_review": len(pending_review),
            "approved_by_me": len([a for a in assigned_apps if a.status in ["officer_approved", "manager_approved", "disbursed"]]),
            "rejected_by_me": len([a for a in assigned_apps if a.status == "officer_rejected"]),
            "disbursed_total": disbursed_total,
            "recent_applications": [
                {"id": a.id, "application_number": a.application_number, "customer_id": a.customer_id,
                 "amount": a.requested_amount, "status": a.status,
                 "date": a.created_at.isoformat() if a.created_at else None}
                for a in recent_apps
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

    # ===== MANAGER =====
    elif current_user.role == "manager":
        all_apps = db.query(LoanApplication).all()
        pending_review = [a for a in all_apps if a.status in ["officer_approved", "officer_rejected"]]
        this_month = [a for a in all_apps if a.created_at and a.created_at >= thirty_days_ago]
        disbursed = [a for a in all_apps if a.status == "disbursed"]

        return {
            "total_applications": len(all_apps),
            "pending_my_review": len(pending_review),
            "approved_by_me": len([a for a in all_apps if a.status in ["manager_approved", "disbursed"]]),
            "rejected_total": len([a for a in all_apps if a.status == "rejected"]),
            "this_month_applications": len(this_month),
            "this_month_amount": sum(a.requested_amount for a in this_month),
            "total_disbursed_amount": sum(calc_loan_total(a) for a in disbursed),
            "applications_by_status": {
                "submitted": len([a for a in all_apps if a.status == "submitted"]),
                "officer_approved": len([a for a in all_apps if a.status == "officer_approved"]),
                "officer_rejected": len([a for a in all_apps if a.status == "officer_rejected"]),
                "manager_approved": len([a for a in all_apps if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_apps if a.status == "disbursed"]),
                "rejected": len([a for a in all_apps if a.status == "rejected"]),
            },
            "pending_applications": [
                {"id": a.id, "application_number": a.application_number,
                 "amount": a.requested_amount, "status": a.status,
                 "date": a.created_at.isoformat() if a.created_at else None}
                for a in pending_review[:5]
            ]
        }

    # ===== CEO =====
    elif current_user.role == "ceo":
        all_apps = db.query(LoanApplication).all()
        all_users = db.query(User).all()

        disbursed_apps = [a for a in all_apps if a.status == "disbursed"]
        pending_review = [a for a in all_apps if a.status == "manager_approved"]

        # Total disbursed = principal + interest
        total_disbursed = sum(calc_loan_total(a) for a in disbursed_apps)

        total_paid = db.query(func.sum(Payment.amount)).scalar() or 0
        remaining_balance = total_disbursed - total_paid

        total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
        total_fixed_deposits = db.query(func.sum(FixedDeposit.amount)).scalar() or 0
        total_shareholders = db.query(func.sum(Shareholder.capital)).scalar() or 0
        total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0

        # Defaults
        defaults_count = 0
        for loan in disbursed_apps:
            try:
                last_payment = db.query(Payment).filter(
                    Payment.loan_application_id == loan.id
                ).order_by(Payment.payment_date.desc()).first()
                days_since = (today - last_payment.payment_date).days if last_payment else (
                    (today - loan.created_at).days if loan.created_at else 0
                )
                if days_since > 30:
                    defaults_count += 1
            except:
                continue

        # Recent applications with customer/product names
        recent_apps = db.query(LoanApplication).order_by(
            LoanApplication.created_at.desc()
        ).limit(10).all()

        recent_list = []
        for app in recent_apps:
            try:
                customer = db.query(User).filter(User.id == app.customer_id).first()
                product = db.query(LoanProduct).filter(LoanProduct.id == app.loan_product_id).first()
                recent_list.append({
                    "id": app.id,
                    "application_number": app.application_number,
                    "customer_name": f"{customer.first_name} {customer.last_name}" if customer else "N/A",
                    "product_name": product.name if product else "N/A",
                    "amount": float(app.requested_amount),
                    "status": app.status,
                    "created_at": app.created_at.isoformat() if app.created_at else None
                })
            except:
                continue

        return {
            "pending_my_review": len(pending_review),
            "total_applications": len(all_apps),
            "total_disbursed": total_disbursed,
            "total_paid": total_paid,
            "remaining_balance": remaining_balance,
            "disbursed_growth": 0,
            "paid_growth": 0,
            "balance_growth": 0,
            "active_loans": len(disbursed_apps),
            "total_customers": len([u for u in all_users if u.role == "customer"]),
            "total_staff": len([u for u in all_users if u.role != "customer"]),
            "total_savings": total_savings,
            "total_fixed_deposits": total_fixed_deposits,
            "shareholder_capital": total_shareholders,
            "total_expenses": total_expenses,
            "defaults_count": defaults_count,
            "applications_by_status": {
                "submitted": len([a for a in all_apps if a.status == "submitted"]),
                "officer_approved": len([a for a in all_apps if a.status == "officer_approved"]),
                "manager_approved": len([a for a in all_apps if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_apps if a.status == "disbursed"]),
                "rejected": len([a for a in all_apps if a.status == "rejected"]),
            },
            "recent_applications": recent_list,
            "pending_applications": [
                {"id": a.id, "application_number": a.application_number,
                 "amount": a.requested_amount, "status": a.status,
                 "date": a.created_at.isoformat() if a.created_at else None}
                for a in pending_review[:5]
            ]
        }

    # ===== ADMIN =====
    elif current_user.role == "admin":
        all_apps = db.query(LoanApplication).all()
        all_users = db.query(User).all()
        all_products = db.query(LoanProduct).filter(LoanProduct.is_active == True).all()

        disbursed_apps = [a for a in all_apps if a.status == "disbursed"]
        total_disbursed = sum(calc_loan_total(a) for a in disbursed_apps)

        total_savings = db.query(func.sum(Savings.balance)).scalar() or 0
        total_fixed_deposits = db.query(func.sum(FixedDeposit.amount)).scalar() or 0
        total_shareholders = db.query(func.sum(Shareholder.capital)).scalar() or 0
        total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0

        users_by_role = defaultdict(int)
        for u in all_users:
            users_by_role[u.role] += 1

        recent_apps = sorted(all_apps, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]

        return {
            "total_users": len(all_users),
            "users_by_role": dict(users_by_role),
            "total_customers": len([u for u in all_users if u.role == "customer"]),
            "active_products": len(all_products),
            "total_applications": len(all_apps),
            "total_disbursed": total_disbursed,
            "total_savings": total_savings,
            "total_fixed_deposits": total_fixed_deposits,
            "shareholder_capital": total_shareholders,
            "total_expenses": total_expenses,
            "applications_by_status": {
                "submitted": len([a for a in all_apps if a.status == "submitted"]),
                "officer_approved": len([a for a in all_apps if a.status == "officer_approved"]),
                "officer_rejected": len([a for a in all_apps if a.status == "officer_rejected"]),
                "manager_approved": len([a for a in all_apps if a.status == "manager_approved"]),
                "disbursed": len([a for a in all_apps if a.status == "disbursed"]),
                "rejected": len([a for a in all_apps if a.status == "rejected"]),
            },
            "recent_applications": [
                {"id": a.id, "application_number": a.application_number,
                 "amount": a.requested_amount, "status": a.status,
                 "date": a.created_at.isoformat() if a.created_at else None}
                for a in recent_apps
            ]
        }

    return {}


@router.get("/reports")
async def get_reports(
    filter: str = "month",
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    all_apps = db.query(LoanApplication).all()
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
        year, month_num = map(int, month.split('-'))
        start_date = datetime(year, month_num, 1)
        end_date = datetime(year + 1, 1, 1) if month_num == 12 else datetime(year, month_num + 1, 1)
        filtered_apps = [a for a in all_apps if a.created_at and start_date <= a.created_at < end_date]
        filter_label = start_date.strftime('%B %Y')
    else:
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"

    if filter != "custom_month":
        filtered_apps = [a for a in all_apps if a.created_at and a.created_at >= start_date]

    # Status breakdown
    status_counts = defaultdict(int)
    for a in all_apps:
        status_counts[a.status] += 1
    applications_by_status = [{"name": k, "value": v} for k, v in status_counts.items()]

    # By product
    all_products = db.query(LoanProduct).all()
    product_names = {p.id: p.name for p in all_products}
    product_data = defaultdict(lambda: {"applications": 0, "amount": 0})
    for a in all_apps:
        name = product_names.get(a.loan_product_id, "Unknown")
        product_data[name]["applications"] += 1
        product_data[name]["amount"] += a.requested_amount
    applications_by_product = [{"name": k, **v} for k, v in product_data.items()]

    # Monthly trend
    monthly_data = {}
    for a in filtered_apps:
        if not a.created_at:
            continue
        if filter in ["day", "week"]:
            key = a.created_at.strftime("%Y-%m-%d")
            label = a.created_at.strftime("%b %d")
        else:
            key = a.created_at.strftime("%Y-%m")
            label = a.created_at.strftime("%b %Y")
        if key not in monthly_data:
            monthly_data[key] = {"month": label, "applications": 0}
        monthly_data[key]["applications"] += 1
    monthly_trend = [monthly_data[k] for k in sorted(monthly_data)]

    # Active vs defaults
    disbursed = [a for a in all_apps if a.status == "disbursed"]
    active_count = defaults_count = 0
    for loan in disbursed:
        last_payment = db.query(Payment).filter(
            Payment.loan_application_id == loan.id
        ).order_by(Payment.payment_date.desc()).first()
        days_since = (now - last_payment.payment_date).days if last_payment else (
            (now - loan.created_at).days if loan.created_at else 0
        )
        if days_since > 30:
            defaults_count += 1
        else:
            active_count += 1

    return {
        "applications_by_status": applications_by_status,
        "applications_by_product": applications_by_product,
        "monthly_trend": monthly_trend,
        "active_vs_defaults": [
            {"name": "Active Payments", "value": active_count},
            {"name": "Defaults", "value": defaults_count}
        ],
        "filter": filter,
        "filter_label": filter_label,
        "start_date": start_date.isoformat(),
        "total_applications": len(all_apps),
        "period_applications": len(filtered_apps),
        "period_total_amount": sum(a.requested_amount for a in filtered_apps),
        "period_approved_count": len([a for a in filtered_apps if a.status in ["manager_approved", "disbursed"]])
    }


@router.get("/reports/export")
async def export_reports(
    filter: str = Query("month", regex="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["manager", "ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now()
    if filter == "day":
        start_date = now - timedelta(hours=24)
        filter_label = "Last 24 Hours"
    elif filter == "week":
        start_date = now - timedelta(days=7)
        filter_label = "Last 7 Days"
    elif filter == "year":
        start_date = now - timedelta(days=365)
        filter_label = "Last Year"
    else:
        start_date = now - timedelta(days=30)
        filter_label = "Last 30 Days"

    all_apps = db.query(LoanApplication).all()
    filtered_apps = [a for a in all_apps if a.created_at and a.created_at >= start_date]
    all_products = db.query(LoanProduct).all()

    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=12)

    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws['A1'] = 'PRIMA LOAN MANAGEMENT — ANALYTICS REPORT'
    ws['A1'].font = Font(bold=True, size=14)
    ws['A2'] = f'Generated: {now.strftime("%Y-%m-%d %H:%M:%S")}'
    ws['A3'] = f'Period: {filter_label}'

    ws['A5'] = 'OVERALL METRICS'
    ws['A5'].font = header_font
    ws['A5'].fill = header_fill
    ws['B5'].fill = header_fill

    total_disbursed = sum(calc_loan_total(a) for a in all_apps if a.status == "disbursed")
    rows = [
        ('Total Applications (All Time)', len(all_apps)),
        (f'Applications ({filter_label})', len(filtered_apps)),
        (f'Amount Requested ({filter_label})', f'₦{sum(a.requested_amount for a in filtered_apps):,.2f}'),
        (f'Approved ({filter_label})', len([a for a in filtered_apps if a.status in ["manager_approved", "disbursed"]])),
        ('Total Disbursed (Principal + Interest)', f'₦{total_disbursed:,.2f}'),
    ]
    for i, (label, value) in enumerate(rows, start=6):
        ws[f'A{i}'] = label
        ws[f'B{i}'] = value

    ws.column_dimensions['A'].width = 40
    ws.column_dimensions['B'].width = 25

    # Status sheet
    ws2 = wb.create_sheet("By Status")
    for col, label in zip(['A', 'B'], ['Status', 'Count']):
        ws2[f'{col}1'] = label
        ws2[f'{col}1'].font = header_font
        ws2[f'{col}1'].fill = header_fill
    status_counts = defaultdict(int)
    for a in all_apps:
        status_counts[a.status] += 1
    for i, (status, count) in enumerate(status_counts.items(), start=2):
        ws2[f'A{i}'] = status
        ws2[f'B{i}'] = count

    # Product sheet
    ws3 = wb.create_sheet("By Product")
    for col, label in zip(['A', 'B', 'C'], ['Product', 'Applications', 'Total Amount']):
        ws3[f'{col}1'] = label
        ws3[f'{col}1'].font = header_font
        ws3[f'{col}1'].fill = header_fill
    product_names = {p.id: p.name for p in all_products}
    product_data = defaultdict(lambda: {"count": 0, "amount": 0})
    for a in all_apps:
        name = product_names.get(a.loan_product_id, "Unknown")
        product_data[name]["count"] += 1
        product_data[name]["amount"] += a.requested_amount
    for i, (name, data) in enumerate(product_data.items(), start=2):
        ws3[f'A{i}'] = name
        ws3[f'B{i}'] = data["count"]
        ws3[f'C{i}'] = f'₦{data["amount"]:,.2f}'

    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    filename = f'PRIMA_Report_{filter_label.replace(" ", "_")}_{now.strftime("%Y%m%d")}.xlsx'
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
    if current_user.role not in ["manager", "ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    officers = db.query(User).filter(User.role == "loan_officer").all()
    performance_data = []

    for officer in officers:
        query = db.query(LoanApplication).filter(
            LoanApplication.assigned_officer_id == officer.id
        )
        if start_date:
            query = query.filter(LoanApplication.created_at >= start_date)
        if end_date:
            query = query.filter(LoanApplication.created_at <= end_date)

        apps = query.all()
        if not apps:
            continue

        disbursed = [a for a in apps if a.status == "disbursed"]
        approved = [a for a in apps if a.status in ["officer_approved", "manager_approved", "disbursed"]]
        rejected = [a for a in apps if a.status in ["officer_rejected", "rejected"]]

        total_disbursed = sum(calc_loan_total(a) for a in disbursed)

        defaults = 0
        for loan in disbursed:
            last_payment = db.query(Payment).filter(
                Payment.loan_application_id == loan.id
            ).order_by(Payment.payment_date.desc()).first()
            days_since = (datetime.now() - last_payment.payment_date).days if last_payment else (
                (datetime.now() - loan.created_at).days if loan.created_at else 0
            )
            if days_since > 30:
                defaults += 1

        performance_data.append({
            "officer_id": officer.id,
            "officer_name": f"{officer.first_name} {officer.last_name}",
            "total_applications": len(apps),
            "approved_applications": len(approved),
            "rejected_applications": len(rejected),
            "disbursed_applications": len(disbursed),
            "approval_rate": (len(approved) / len(apps) * 100) if apps else 0,
            "total_disbursed": total_disbursed,
            "defaults_count": defaults,
            "default_rate": (defaults / len(disbursed) * 100) if disbursed else 0,
        })

    return performance_data


@router.get("/revenue-vs-expenses")
async def get_revenue_vs_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["manager", "ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    payments_query = db.query(Payment)
    expenses_query = db.query(Expense)

    if start_date:
        payments_query = payments_query.filter(Payment.payment_date >= start_date)
        expenses_query = expenses_query.filter(Expense.expense_date >= start_date)
    if end_date:
        payments_query = payments_query.filter(Payment.payment_date <= end_date)
        expenses_query = expenses_query.filter(Expense.expense_date <= end_date)

    payments = payments_query.all()
    expenses = expenses_query.all()

    total_revenue = sum(p.amount for p in payments)
    total_expenses = sum(e.amount for e in expenses)
    net_profit = total_revenue - total_expenses

    monthly_data = defaultdict(lambda: {"revenue": 0, "expenses": 0})
    for p in payments:
        if p.payment_date:
            monthly_data[p.payment_date.strftime("%Y-%m")]["revenue"] += p.amount
    for e in expenses:
        if e.expense_date:
            monthly_data[e.expense_date.strftime("%Y-%m")]["expenses"] += e.amount

    monthly_breakdown = [
        {"month": k, "revenue": v["revenue"], "expenses": v["expenses"],
         "net_profit": v["revenue"] - v["expenses"]}
        for k, v in sorted(monthly_data.items())
    ]

    category_totals = defaultdict(float)
    for e in expenses:
        category_totals[e.category] += e.amount

    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "profit_margin": (net_profit / total_revenue * 100) if total_revenue > 0 else 0
        },
        "monthly_breakdown": monthly_breakdown,
        "expense_categories": [{"category": k, "amount": v} for k, v in category_totals.items()],
        "revenue_sources": {"loan_repayments": total_revenue}
    }