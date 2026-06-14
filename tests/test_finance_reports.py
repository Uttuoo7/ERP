import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from backend import models
from backend.services.posting_engine import PostingEngine
from backend.services.finance_report_service import FinanceReportService

pytestmark = pytest.mark.finance

def seed_test_coa(db_session):
    # Seed new accounts if not already seeded
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
    accounts_by_code = {}
    for acc_data in target_accounts:
        acc = db_session.query(models.Account).filter(models.Account.code == acc_data["code"]).first()
        if not acc:
            acc = models.Account(
                code=acc_data["code"],
                name=acc_data["name"],
                account_type=acc_data["account_type"],
                is_active=True
            )
            db_session.add(acc)
            db_session.flush()
        else:
            acc.name = acc_data["name"]
            acc.account_type = acc_data["account_type"]
            db_session.flush()
        accounts_by_code[acc_data["code"]] = acc
    return accounts_by_code

class TestFinanceReportsAPI:
    def test_balance_sheet_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/balance-sheet", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        assert "assets_equals_liabilities_plus_equity" in data
        assert data["assets_equals_liabilities_plus_equity"] is True

    def test_profit_loss_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/profit-loss", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "revenue" in data
        assert "cogs" in data
        assert "expenses" in data
        assert "total_revenue" in data
        assert "total_cogs" in data
        assert "net_profit" in data

    def test_cash_flow_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/cash-flow", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "net_profit" in data
        assert "operating_cash_flow" in data
        assert "opening_cash" in data
        assert "closing_cash" in data

    def test_ap_reconciliation_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/ap-reconciliation", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "gl_balance" in data
        assert "subledger_balance" in data
        assert "difference" in data
        assert "status" in data

    def test_grni_reconciliation_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/grni-reconciliation", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "gl_balance" in data
        assert "subledger_balance" in data
        assert "difference" in data
        assert "status" in data

    def test_health_endpoint(self, client, finance_headers, db_session):
        seed_test_coa(db_session)
        response = client.get("/api/finance/health", headers=finance_headers)
        assert response.status_code == 200
        data = response.json()
        assert "trial_balance" in data
        assert "ap_reconciliation" in data
        assert "grni_reconciliation" in data
        assert "cash_position" in data
        assert "unposted_transactions" in data
        assert "alerts" in data
