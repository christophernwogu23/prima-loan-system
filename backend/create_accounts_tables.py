from app.database import engine, Base
from app.models.transit_account import TransitDeposit
from app.models.suspense_account import SuspensePayment

# This will create the tables
Base.metadata.create_all(bind=engine)
print("✅ Transit and Suspense account tables created!")