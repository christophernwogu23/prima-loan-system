from collections import OrderedDict
from datetime import datetime
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.loan_application import LoanApplication
from app.models.loan_product import LoanProduct
from app.models.payment import Payment
from app.utils.loan_calc import loan_amounts

# No prefix here: reports.py includes this router, so the paths become
#   GET /reports/loan-balances
#   GET /reports/loan-balances/export
router = APIRouter(tags=["Reports"])

VIEW_ROLES = ["admin", "ceo", "manager", "loan_officer"]
EXPORT_ROLES = ["admin", "ceo", "manager"]
STATUS_FILTERS = ("active", "paid", "all")


def _build_report(
    db: Session,
    current_user: User,
    search: Optional[str],
    status: str,
    officer_id: Optional[int],
):
    """One entry per customer, each with their disbursed loans and balances."""
    query = (
        db.query(LoanApplication, User, LoanProduct.name)
        .join(User, LoanApplication.customer_id == User.id)
        .join(LoanProduct, LoanApplication.loan_product_id == LoanProduct.id)
        .filter(LoanApplication.status == "disbursed")
    )

    # Loan officers only ever see their own customers' loans
    if current_user.role == "loan_officer":
        query = query.filter(LoanApplication.assigned_officer_id == current_user.id)
    elif officer_id:
        query = query.filter(LoanApplication.assigned_officer_id == officer_id)

    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                func.concat(User.first_name, " ", User.last_name).ilike(like),
                LoanApplication.application_number.ilike(like),
            )
        )

    rows = query.all()

    # One query for all repayments, instead of one query per loan
    paid_map = {}
    loan_ids = [loan.id for loan, _, _ in rows]
    if loan_ids:
        paid_rows = (
            db.query(
                Payment.loan_application_id,
                func.coalesce(func.sum(Payment.amount), 0),
                func.max(Payment.payment_date),
            )
            .filter(Payment.loan_application_id.in_(loan_ids))
            .group_by(Payment.loan_application_id)
            .all()
        )
        for loan_id, paid, last_date in paid_rows:
            paid_map[loan_id] = (float(paid), last_date)

    customers = OrderedDict()
    for loan, customer, product_name in rows:
        paid, last_date = paid_map.get(loan.id, (0.0, None))
        amounts = loan_amounts(loan, paid)

        if status == "active" and amounts["is_fully_paid"]:
            continue
        if status == "paid" and not amounts["is_fully_paid"]:
            continue

        entry = customers.get(customer.id)
        if entry is None:
            entry = customers[customer.id] = {
                "customer_id": customer.id,
                "customer_name": f"{customer.first_name} {customer.last_name}".strip(),
                "loans_count": 0,
                "active_loans": 0,
                "total_repayable": 0.0,
                "total_paid": 0.0,
                "outstanding_balance": 0.0,
                "loans": [],
            }

        entry["loans_count"] += 1
        if not amounts["is_fully_paid"]:
            entry["active_loans"] += 1
        entry["total_repayable"] += amounts["total_repayable"]
        entry["total_paid"] += amounts["total_paid"]
        entry["outstanding_balance"] += amounts["outstanding_balance"]

        entry["loans"].append({
            "loan_id": loan.id,
            "application_number": loan.application_number,
            "product_name": product_name,
            "tenure_months": loan.tenure_months,
            "emi_amount": loan.emi_amount,
            "disbursed_amount": amounts["principal"],
            "interest_amount": amounts["interest_amount"],
            "total_repayable": amounts["total_repayable"],
            "total_paid": amounts["total_paid"],
            "outstanding_balance": amounts["outstanding_balance"],
            "overpaid": amounts["overpaid"],
            "status": "paid" if amounts["is_fully_paid"] else "active",
            "last_payment_date": last_date.isoformat() if last_date else None,
        })

    result = list(customers.values())
    for c in result:
        for key in ("total_repayable", "total_paid", "outstanding_balance"):
            c[key] = round(c[key], 2)
        c["loans"].sort(key=lambda l: l["outstanding_balance"], reverse=True)
    result.sort(key=lambda c: (-c["outstanding_balance"], c["customer_name"].lower()))

    summary = {
        "customers": len(result),
        "customers_with_balance": sum(1 for c in result if c["outstanding_balance"] > 0),
        "loans": sum(c["loans_count"] for c in result),
        "total_repayable": round(sum(c["total_repayable"] for c in result), 2),
        "total_paid": round(sum(c["total_paid"] for c in result), 2),
        "total_outstanding": round(sum(c["outstanding_balance"] for c in result), 2),
    }
    return {"summary": summary, "customers": result}


def _check_status(status: str):
    if status not in STATUS_FILTERS:
        raise HTTPException(status_code=400, detail="status must be active, paid or all")


@router.get("/loan-balances")
def get_loan_balances(
    search: Optional[str] = None,
    status: str = "active",
    officer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Outstanding loan balance for every customer with a disbursed loan.
    status: active (still owing, default), paid (fully repaid) or all.
    """
    if current_user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    _check_status(status)
    return _build_report(db, current_user, search, status, officer_id)


# ---------------------------------------------------------------------------
# Excel export
# ---------------------------------------------------------------------------

MONEY_FORMAT = "#,##0.00"


def _write_header(ws, row: int, headers):
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=header)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")


def _money(ws, row: int, col: int, value, bold: bool = False):
    cell = ws.cell(row=row, column=col, value=value)
    cell.number_format = MONEY_FORMAT
    if bold:
        cell.font = Font(bold=True)


@router.get("/loan-balances/export")
def export_loan_balances(
    search: Optional[str] = None,
    status: str = "active",
    officer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in EXPORT_ROLES:
        raise HTTPException(status_code=403, detail="Access denied")
    _check_status(status)

    report = _build_report(db, current_user, search, status, officer_id)
    customers = report["customers"]
    summary = report["summary"]

    wb = Workbook()

    # Sheet 1: one row per customer
    ws = wb.active
    ws.title = "By customer"
    ws["A1"] = "PRIMA - LOAN BALANCES BY CUSTOMER"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = f"As at {datetime.now().strftime('%d %B %Y')}"
    _write_header(ws, 4, ["Customer", "Loans", "Active loans", "Total repayable", "Total paid", "Outstanding balance"])

    row = 5
    for c in customers:
        ws.cell(row=row, column=1, value=c["customer_name"])
        ws.cell(row=row, column=2, value=c["loans_count"])
        ws.cell(row=row, column=3, value=c["active_loans"])
        _money(ws, row, 4, c["total_repayable"])
        _money(ws, row, 5, c["total_paid"])
        _money(ws, row, 6, c["outstanding_balance"])
        row += 1

    row += 1
    ws.cell(row=row, column=1, value="TOTAL").font = Font(bold=True)
    _money(ws, row, 4, summary["total_repayable"], bold=True)
    _money(ws, row, 5, summary["total_paid"], bold=True)
    _money(ws, row, 6, summary["total_outstanding"], bold=True)

    for col, width in zip("ABCDEF", (30, 8, 14, 20, 20, 22)):
        ws.column_dimensions[col].width = width

    # Sheet 2: one row per loan
    ws2 = wb.create_sheet("By loan")
    ws2["A1"] = "PRIMA - LOAN BALANCES BY LOAN"
    ws2["A1"].font = Font(bold=True, size=14)
    ws2["A2"] = f"As at {datetime.now().strftime('%d %B %Y')}"
    _write_header(ws2, 4, [
        "Customer", "Loan number", "Product", "Disbursed", "Interest",
        "Total repayable", "Total paid", "Outstanding balance", "Status", "Last payment",
    ])

    row = 5
    for c in customers:
        for loan in c["loans"]:
            ws2.cell(row=row, column=1, value=c["customer_name"])
            ws2.cell(row=row, column=2, value=loan["application_number"])
            ws2.cell(row=row, column=3, value=loan["product_name"])
            _money(ws2, row, 4, loan["disbursed_amount"])
            _money(ws2, row, 5, loan["interest_amount"])
            _money(ws2, row, 6, loan["total_repayable"])
            _money(ws2, row, 7, loan["total_paid"])
            _money(ws2, row, 8, loan["outstanding_balance"])
            ws2.cell(row=row, column=9, value="Paid" if loan["status"] == "paid" else "Active")
            ws2.cell(row=row, column=10, value=(loan["last_payment_date"] or "")[:10])
            row += 1

    row += 1
    ws2.cell(row=row, column=1, value="TOTAL").font = Font(bold=True)
    _money(ws2, row, 6, summary["total_repayable"], bold=True)
    _money(ws2, row, 7, summary["total_paid"], bold=True)
    _money(ws2, row, 8, summary["total_outstanding"], bold=True)

    for col, width in zip("ABCDEFGHIJ", (30, 18, 22, 16, 16, 18, 16, 20, 10, 14)):
        ws2.column_dimensions[col].width = width

    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    filename = f'PRIMA_Loan_Balances_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )