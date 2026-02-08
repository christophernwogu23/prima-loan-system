from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.loan_application import LoanApplication
from app.models.payment import Payment
from app.models.notification import Notification
from app.models.user import User

def calculate_next_payment_due(loan: LoanApplication, db: Session):
    """Calculate the next payment due date for a loan"""
    
    if loan.status != 'disbursed' or not loan.disbursed_date:
        return None
    
    # Get all payments for this loan
    payments = db.query(Payment).filter(
        Payment.loan_application_id == loan.id
    ).order_by(Payment.payment_date.desc()).all()
    
    # If no payments yet, first payment is due 30 days after disbursement
    if not payments:
        first_due = loan.disbursed_date + timedelta(days=30)
        return first_due
    
    # Calculate how many payments have been made
    total_paid = sum(p.amount for p in payments)
    expected_monthly = (loan.approved_amount or loan.requested_amount) / loan.tenure_months
    payments_made = int(total_paid / expected_monthly)
    
    # If loan is fully paid, no next payment
    if payments_made >= loan.tenure_months:
        return None
    
    # Next payment due date
    next_due = loan.disbursed_date + timedelta(days=30 * (payments_made + 1))
    return next_due


def generate_payment_reminders(db: Session):
    """Generate notifications for payments due within 7 days"""
    
    # Get all active loans
    active_loans = db.query(LoanApplication).filter(
        LoanApplication.status == 'disbursed'
    ).all()
    
    notifications_created = 0
    today = datetime.now().date()
    
    for loan in active_loans:
        try:
            next_due = calculate_next_payment_due(loan, db)
            
            if not next_due:
                continue
            
            # Convert to date for comparison
            next_due_date = next_due.date() if isinstance(next_due, datetime) else next_due
            days_until_due = (next_due_date - today).days
            
            # Only create notification if payment is due in 1-7 days
            if 1 <= days_until_due <= 7:
                # Check if notification already exists for this due date
                existing = db.query(Notification).filter(
                    Notification.user_id == loan.customer_id,
                    Notification.type == 'payment_due_soon',
                    Notification.date >= today
                ).first()
                
                if not existing:
                    # Calculate expected payment amount
                    expected_amount = (loan.approved_amount or loan.requested_amount) / loan.tenure_months
                    
                    # Create notification for customer
                    customer_notification = Notification(
                        user_id=loan.customer_id,
                        type='payment_due_soon',
                        title='Payment Due Soon',
                        message=f'Your loan payment of ₦{expected_amount:,.0f} is due on {next_due_date.strftime("%d %b %Y")} ({days_until_due} days)',
                        read=False,
                        date=datetime.now()
                    )
                    db.add(customer_notification)
                    
                    # Create notification for assigned loan officer
                    if loan.assigned_officer_id:
                        officer_notification = Notification(
                            user_id=loan.assigned_officer_id,
                            type='payment_due_soon',
                            title='Customer Payment Due',
                            message=f'Customer payment of ₦{expected_amount:,.0f} for {loan.application_number} is due on {next_due_date.strftime("%d %b %Y")}',
                            read=False,
                            date=datetime.now()
                        )
                        db.add(officer_notification)
                    
                    notifications_created += 1
        
        except Exception as e:
            print(f"Error processing loan {loan.id}: {e}")
            continue
    
    db.commit()
    return notifications_created