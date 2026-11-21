"""
Shared loan arithmetic, so the loan balances report, the defaults page and the
payment screens all work from the same numbers.

The rules below copy what payments.py already does today:
  * principal  = approved_amount, or requested_amount if there is no approved amount
  * imported loans (application number starts with "IMP-") already include their
    interest in the amount, so no interest is added on top
  * every other loan adds a flat interest of principal x interest_rate / 100
There is no penalty tracking in the system yet, so penalties are not part of any
balance here.
"""

IMPORTED_PREFIX = "IMP-"


def is_imported(loan) -> bool:
    return bool(loan.application_number and loan.application_number.startswith(IMPORTED_PREFIX))


def loan_amounts(loan, total_paid) -> dict:
    """Money figures for one loan, given the total repaid on it so far."""
    principal = loan.approved_amount or loan.requested_amount or 0.0
    rate = loan.interest_rate or 0.0
    interest = 0.0 if is_imported(loan) else principal * rate / 100

    total_repayable = principal + interest
    paid = float(total_paid or 0.0)
    remaining = total_repayable - paid

    return {
        "principal": round(principal, 2),
        "interest_amount": round(interest, 2),
        "total_repayable": round(total_repayable, 2),
        "total_paid": round(paid, 2),
        "outstanding_balance": round(max(remaining, 0.0), 2),
        "overpaid": round(max(-remaining, 0.0), 2) + 0.0,  # + 0.0 avoids a "-0.0"
        "is_fully_paid": remaining <= 0.005,
    }