import sys
import os
import json
from decimal import Decimal
from datetime import datetime
from fastapi.testclient import TestClient

# Ensure the root folder is in the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend.services.finance_report_service import FinanceReportService
from backend.main import app
from backend.auth_utils import create_access_token
from tests.factories.entity_factories import UserFactory
import backend.models as models

def decimal_serializer(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def run_backend_validation():
    print("=" * 60)
    print("1. BACKEND REPORT VALIDATION")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Get active entries in general ledger
        # 1. Balance Sheet
        print("\n--- Balance Sheet ---")
        bs = FinanceReportService.get_balance_sheet(db)
        print(json.dumps(bs, default=decimal_serializer, indent=2))
        
        # Validate BS Keys
        required_bs_keys = ["assets", "liabilities", "equity", "total_assets", "total_liabilities", "total_equity", "assets_equals_liabilities_plus_equity", "difference"]
        for key in required_bs_keys:
            assert key in bs, f"Missing key '{key}' in Balance Sheet"
        print("[PASS] All required Balance Sheet keys exist.")
        
        # Verify Accounting Equation
        eq_check = bs["assets_equals_liabilities_plus_equity"]
        calculated_diff = abs(bs["total_assets"] - (bs["total_liabilities"] + bs["total_equity"]))
        print(f"Total Assets: {bs['total_assets']}")
        print(f"Total Liabilities + Equity: {bs['total_liabilities'] + bs['total_equity']}")
        print(f"Accounting Equation Balanced: {eq_check} (Diff: {calculated_diff})")
        assert calculated_diff < 0.01, f"Balance Sheet does not balance! Diff: {calculated_diff}"
        print("[PASS] Balance Sheet satisfies Accounting Equation: Assets = Liabilities + Equity")
        
        # 2. Profit & Loss
        print("\n--- Profit & Loss ---")
        pl = FinanceReportService.get_profit_and_loss(db)
        print(json.dumps(pl, default=decimal_serializer, indent=2))
        
        # Validate P&L Keys
        required_pl_keys = ["revenue", "cogs", "expenses", "total_revenue", "total_cogs", "gross_profit", "total_expenses", "net_profit"]
        for key in required_pl_keys:
            assert key in pl, f"Missing key '{key}' in P&L"
        print("[PASS] All required P&L keys exist.")
        
        # Verify P&L Math
        gross_profit_check = pl["total_revenue"] - pl["total_cogs"]
        net_profit_check = gross_profit_check - pl["total_expenses"]
        assert abs(pl["gross_profit"] - gross_profit_check) < 0.01, f"Gross profit mismatch: {pl['gross_profit']} vs {gross_profit_check}"
        assert abs(pl["net_profit"] - net_profit_check) < 0.01, f"Net profit mismatch: {pl['net_profit']} vs {net_profit_check}"
        print(f"Gross Profit: {pl['gross_profit']}")
        print(f"Net Profit: {pl['net_profit']}")
        print("[PASS] Profit & Loss satisfies mathematical formula: Revenue - COGS - Expenses = Net Profit")
        
        # 3. Cash Flow
        print("\n--- Cash Flow ---")
        cf = FinanceReportService.get_cash_flow(db)
        print(json.dumps(cf, default=decimal_serializer, indent=2))
        
        # Validate Cash Flow Keys
        required_cf_keys = ["operating_cash_flow", "investing_cash_flow", "financing_cash_flow", "net_cash_movement", "opening_cash", "closing_cash", "reconciliation_balanced"]
        for key in required_cf_keys:
            assert key in cf, f"Missing key '{key}' in Cash Flow"
        print("[PASS] All required Cash Flow keys exist.")
        
        # Verify Cash Flow Math
        net_change = cf["operating_cash_flow"] + cf["investing_cash_flow"] + cf["financing_cash_flow"]
        assert abs(cf["net_cash_movement"] - net_change) < 0.01, f"Net movement mismatch: {cf['net_cash_movement']} vs {net_change}"
        reconciled_closing = cf["opening_cash"] + cf["net_cash_movement"]
        assert abs(cf["closing_cash"] - reconciled_closing) < 0.01, f"Closing cash mismatch: {cf['closing_cash']} vs {reconciled_closing}"
        print(f"Opening Cash: {cf['opening_cash']}, Net Change: {cf['net_cash_movement']}, Closing Cash: {cf['closing_cash']}")
        print(f"Cash Flow Reconciled: {cf['reconciliation_balanced']}")
        print("[PASS] Cash Flow satisfies: Opening Cash + Net Change = Closing Cash")
        
        # 4. AP Reconciliation
        print("\n--- AP Reconciliation ---")
        ap = FinanceReportService.get_ap_reconciliation(db)
        print(json.dumps(ap, default=decimal_serializer, indent=2))
        
        # Validate AP Keys
        required_ap_keys = ["gl_balance", "subledger_balance", "difference", "status", "vendors"]
        for key in required_ap_keys:
            assert key in ap, f"Missing key '{key}' in AP Reconciliation"
        print("[PASS] All required AP Reconciliation keys exist.")
        
        # Verify reconciliation
        ap_diff = ap["gl_balance"] - ap["subledger_balance"]
        assert abs(ap["difference"] - ap_diff) < 0.01, f"AP diff mismatch: {ap['difference']} vs {ap_diff}"
        print(f"AP GL: {ap['gl_balance']}, Subledger: {ap['subledger_balance']}, Difference: {ap['difference']}")
        print(f"Reconciliation Status: {ap['status']}")
        print("[PASS] AP Reconciliation matches computed difference.")
        
        # 5. GRNI Reconciliation
        print("\n--- GRNI Reconciliation ---")
        grni = FinanceReportService.get_grni_reconciliation(db)
        print(json.dumps(grni, default=decimal_serializer, indent=2))
        
        # Validate GRNI Keys
        required_grni_keys = ["gl_balance", "subledger_balance", "difference", "status", "uninvoiced_grns"]
        for key in required_grni_keys:
            assert key in grni, f"Missing key '{key}' in GRNI Reconciliation"
        print("[PASS] All required GRNI Reconciliation keys exist.")
        
        # Verify reconciliation
        grni_diff = grni["gl_balance"] - grni["subledger_balance"]
        assert abs(grni["difference"] - grni_diff) < 0.01, f"GRNI diff mismatch: {grni['difference']} vs {grni_diff}"
        print(f"GRNI GL: {grni['gl_balance']}, Subledger: {grni['subledger_balance']}, Difference: {grni['difference']}")
        print(f"Reconciliation Status: {grni['status']}")
        print("[PASS] GRNI Reconciliation matches computed difference.")
        
        # 6. Finance Health
        print("\n--- Finance Health Dashboard ---")
        health = FinanceReportService.get_finance_health(db)
        print(json.dumps(health, default=decimal_serializer, indent=2))
        
        # Validate Health Keys
        required_health_keys = ["trial_balance", "ap_reconciliation", "grni_reconciliation", "cash_position", "open_periods", "last_journal_voucher", "unposted_transactions", "alerts"]
        for key in required_health_keys:
            assert key in health, f"Missing key '{key}' in Finance Health"
        print("[PASS] All required Finance Health Dashboard keys exist.")
        
    finally:
        db.close()

def run_api_validation():
    print("\n" + "=" * 60)
    print("2. API ENDPOINT VALIDATION")
    print("=" * 60)
    
    db = SessionLocal()
    # Create an admin user to generate a valid authorization token
    admin_user = db.query(models.User).filter(models.User.role == "ADMIN").first()
    if not admin_user:
        admin_user = UserFactory.create(db, role="ADMIN", email="audit_admin@p2p_erp.local")
        db.commit()
    
    # Generate token using backend function
    token = create_access_token({
        "sub": str(admin_user.id), 
        "role": "ADMIN",
        "tenant_id": str(admin_user.tenant_id) if admin_user.tenant_id else None
    })
    headers = {"Authorization": f"Bearer {token}"}
    db.close()
    
    client = TestClient(app)
    
    endpoints = [
        "/api/finance/balance-sheet",
        "/api/finance/profit-loss",
        "/api/finance/cash-flow",
        "/api/finance/ap-reconciliation",
        "/api/finance/grni-reconciliation",
        "/api/finance/health"
    ]
    
    for ep in endpoints:
        print(f"\nTesting endpoint: GET {ep}")
        # Test without auth
        res_no_auth = client.get(ep)
        print(f"Status (No Auth): {res_no_auth.status_code}")
        assert res_no_auth.status_code in (401, 403), "Accessing reports without auth should be rejected"
        
        # Test with auth
        res = client.get(ep, headers=headers)
        print(f"Status (Auth): {res.status_code}")
        assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}"
        
        # Verify JSON schema and serialization
        data = res.json()
        assert isinstance(data, dict), "Response must be a JSON object"
        print(f"[PASS] GET {ep} executed successfully with HTTP 200 and valid schema.")

if __name__ == "__main__":
    try:
        run_backend_validation()
        run_api_validation()
        print("\n" + "=" * 60)
        print("GO-LIVE READINESS CHECKS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Assertion Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n[FAIL] Exception raised: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(2)
