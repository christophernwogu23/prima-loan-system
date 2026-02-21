from app.database import SessionLocal, Base, engine
from app.models.gl_account import GLAccount

# Create tables
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Default Chart of Accounts for PRIMA
default_accounts = [
    # ASSETS
    {"code": "1001", "name": "Bank Account", "type": "asset", "desc": "Main company bank account"},
    {"code": "1002", "name": "Cash on Hand", "type": "asset", "desc": "Physical cash"},
    {"code": "1003", "name": "Loans Receivable", "type": "asset", "desc": "Money owed by customers"},
    {"code": "1004", "name": "Office Equipment", "type": "asset", "desc": "Computers, furniture, etc."},
    {"code": "1005", "name": "Vehicles", "type": "asset", "desc": "Company vehicles"},
    {"code": "1006", "name": "Office Building", "type": "asset", "desc": "Company property"},
    
    # LIABILITIES
    {"code": "2001", "name": "Customer Savings", "type": "liability", "desc": "Customer deposits"},
    {"code": "2002", "name": "Fixed Deposits", "type": "liability", "desc": "Customer fixed deposits"},
    {"code": "2003", "name": "Accounts Payable", "type": "liability", "desc": "Money owed to suppliers"},
    
    # EQUITY
    {"code": "3001", "name": "Shareholder Capital", "type": "equity", "desc": "Shareholder investments"},
    {"code": "3002", "name": "Retained Earnings", "type": "equity", "desc": "Accumulated profits"},
    
    # INCOME
    {"code": "4001", "name": "Interest Income", "type": "income", "desc": "Interest earned from loans"},
    {"code": "4002", "name": "Upfront Fee Income", "type": "income", "desc": "Loan processing fees"},
    {"code": "4003", "name": "Admin Fee Income", "type": "income", "desc": "Administrative charges"},
    
    # EXPENSES
    {"code": "5001", "name": "Salary Expense", "type": "expense", "desc": "Staff salaries"},
    {"code": "5002", "name": "Rent Expense", "type": "expense", "desc": "Office rent"},
    {"code": "5003", "name": "Utilities Expense", "type": "expense", "desc": "Electricity, water, internet"},
    {"code": "5004", "name": "General Expenses", "type": "expense", "desc": "Other operating expenses"},
]

print("Creating default GL accounts...")

for acc in default_accounts:
    # Check if exists
    existing = db.query(GLAccount).filter(GLAccount.account_code == acc["code"]).first()
    if not existing:
        gl_account = GLAccount(
            account_code=acc["code"],
            account_name=acc["name"],
            account_type=acc["type"],
            description=acc["desc"],
            current_balance=0.0
        )
        db.add(gl_account)
        print(f"✓ Created: {acc['code']} - {acc['name']}")
    else:
        print(f"- Already exists: {acc['code']} - {acc['name']}")

db.commit()
print("\n✅ Default GL accounts created!")
db.close()