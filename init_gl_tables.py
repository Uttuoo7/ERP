import os
import uuid
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend.models import Base, Account, AccountingPeriod, PostingConfiguration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_gl_data():
    # 1. Create tables
    logger.info("Initializing General Ledger database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Tables created successfully.")
    
    db: Session = SessionLocal()
    try:
        # 2. Seed Chart of Accounts (COA)
        logger.info("Seeding Chart of Accounts...")
        default_accounts = [
            # Assets
            {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
            {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
            {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
            # Liabilities
            {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
            {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
            {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
            # Equity
            {"code": "3000", "name": "Retained Earnings", "account_type": "EQUITY"},
            # Revenue
            {"code": "4000", "name": "Sales Revenue", "account_type": "REVENUE"},
            # Expenses
            {"code": "5000", "name": "Purchase Control Account (COGS)", "account_type": "EXPENSE"},
            {"code": "5100", "name": "Operating Expense Account", "account_type": "EXPENSE"},
        ]
        
        accounts_by_code = {}
        for acc_data in default_accounts:
            existing = db.query(Account).filter(Account.code == acc_data["code"]).first()
            if not existing:
                account = Account(
                    code=acc_data["code"],
                    name=acc_data["name"],
                    account_type=acc_data["account_type"],
                    is_active=True
                )
                db.add(account)
                db.flush()
                logger.info(f"Seeded Account: {account.code} - {account.name}")
                accounts_by_code[acc_data["code"]] = account
            else:
                accounts_by_code[acc_data["code"]] = existing

        # 3. Seed Accounting Periods for 2026
        logger.info("Seeding 2026 Accounting Periods...")
        for month in range(1, 13):
            period_name = f"2026-{month:02d}"
            existing = db.query(AccountingPeriod).filter(AccountingPeriod.period_name == period_name).first()
            if not existing:
                start_date = datetime(2026, month, 1)
                if month == 12:
                    end_date = datetime(2026, 12, 31, 23, 59, 59)
                else:
                    end_date = datetime(2026, month + 1, 1) # simple logic
                
                period = AccountingPeriod(
                    period_name=period_name,
                    start_date=start_date,
                    end_date=end_date,
                    status="OPEN"
                )
                db.add(period)
                logger.info(f"Seeded Accounting Period: {period_name}")
        
        # 4. Seed Posting Configurations
        logger.info("Seeding Posting Configurations...")
        configs = [
            {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
            {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
            {"event_key": "GST_RECEIVABLE", "account_code": "1300"},
            {"event_key": "TDS_PAYABLE", "account_code": "2200"},
            {"event_key": "AP_CONTROL", "account_code": "2000"},
            {"event_key": "BANK_CONTROL", "account_code": "1000"},
        ]
        
        for cfg in configs:
            existing = db.query(PostingConfiguration).filter(PostingConfiguration.event_key == cfg["event_key"]).first()
            if not existing:
                acc = accounts_by_code.get(cfg["account_code"])
                if acc:
                    config = PostingConfiguration(
                        event_key=cfg["event_key"],
                        account_id=acc.id
                    )
                    db.add(config)
                    logger.info(f"Seeded Posting Configuration: {cfg['event_key']} -> {cfg['account_code']}")
        
        db.commit()
        logger.info("Database seeding completed successfully.")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error during seeding: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_gl_data()
