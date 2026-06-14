import os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.models import Account
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_accounts():
    db = SessionLocal()
    try:
        # Accounts to ensure exist
        target_accounts = [
            {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
            {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
            {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
            {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
            {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
            {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
            {"code": "3000", "name": "Owner's Equity", "account_type": "EQUITY"},
            {"code": "3100", "name": "Retained Earnings", "account_type": "EQUITY"},
            {"code": "4000", "name": "Sales Revenue", "account_type": "REVENUE"},
            {"code": "4100", "name": "Other Income", "account_type": "REVENUE"},
            {"code": "5000", "name": "Cost of Goods Sold", "account_type": "EXPENSE"},
            {"code": "6000", "name": "Procurement Expenses", "account_type": "EXPENSE"},
            {"code": "6100", "name": "Administrative Expenses", "account_type": "EXPENSE"},
            {"code": "6200", "name": "Finance Expenses", "account_type": "EXPENSE"},
        ]

        for acc_data in target_accounts:
            acc = db.query(Account).filter(Account.code == acc_data["code"]).first()
            if acc:
                # Update name and type to match target
                if acc.name != acc_data["name"] or acc.account_type != acc_data["account_type"]:
                    logger.info(f"Updating account {acc.code}: {acc.name} -> {acc_data['name']}")
                    acc.name = acc_data["name"]
                    acc.account_type = acc_data["account_type"]
            else:
                new_acc = Account(
                    code=acc_data["code"],
                    name=acc_data["name"],
                    account_type=acc_data["account_type"],
                    is_active=True
                )
                db.add(new_acc)
                logger.info(f"Created account {new_acc.code}: {new_acc.name} ({new_acc.account_type})")
        
        db.commit()
        logger.info("Finance accounts seeded successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding accounts: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_accounts()
