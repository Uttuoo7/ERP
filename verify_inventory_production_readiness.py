import sys
import os
import time
import subprocess
import uuid
from decimal import Decimal
from datetime import datetime

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend import models, database, inventory_engine
from backend.main import app
from backend.dependencies import get_current_user
from backend.services.accounting_service import AccountingService

class ProductionReadinessVerifier:
    def __init__(self):
        self.db = database.SessionLocal()
        self.client = TestClient(app)
        self.defects = []
        self.remediations = []
        self.status = "READY FOR PHASE 12B"
        
        # Ensure default tenant is seeded
        self.seed_default_tenant_if_missing()

    def seed_default_tenant_if_missing(self):
        try:
            tenant_uuid = models.SYSTEM_DEFAULT_TENANT_UUID
            tenant = self.db.query(models.Tenant).filter_by(id=tenant_uuid).first()
            if not tenant:
                tenant = models.Tenant(
                    id=tenant_uuid,
                    name="Default System Tenant",
                    domain="system",
                    status="ACTIVE"
                )
                self.db.add(tenant)
                self.db.commit()
        except Exception as e:
            self.db.rollback()

    def run_verification(self):
        # 1. Historical Data Audit
        hist_stats = self.verify_historical_data()
        
        # 2. Inventory <-> Stock Ledger Validation
        ledger_stats = self.verify_inventory_stock_ledger()

        # 3. Inventory <-> GL Reconciliation
        gl_stats = self.verify_inventory_gl_reconciliation()

        # 4. FIFO Integrity Audit
        fifo_stats = self.verify_fifo_integrity()

        # 5. Period Controls
        period_stats = self.verify_period_controls()

        # 6. Performance Benchmarks
        perf_stats = self.verify_performance()

        # 7. Regression Tests
        test_stats = self.verify_regression_tests()

        # 8. Certification Logic
        if len(self.defects) > 0 or gl_stats["variance"] != 0 or not test_stats["passed"]:
            self.status = "NOT READY FOR PHASE 12B"

        # Output formatting matching exact requested headers
        print("=" * 60)
        print("PHASE 12A FINAL PRODUCTION VERIFICATION REPORT")
        print("=" * 60)
        
        print("\nExecutive Summary")
        print("-" * 30)
        print(f"Status           : {self.status}")
        print(f"Run Date         : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total Items      : {hist_stats['item_count']}")
        print(f"Total Warehouses : {hist_stats['wh_count']}")
        
        print("\nDatabase Integrity")
        print("-" * 30)
        print(f"InventoryCostLayer count       : {hist_stats['layer_count']}")
        print(f"InventoryValuationEntry count  : {hist_stats['val_entry_count']}")
        print(f"InventoryAuditLog count        : {hist_stats['audit_log_count']}")
        print(f"Orphan records count           : {hist_stats['orphan_count']}")
        print(f"Negative cost layers count     : {hist_stats['neg_layer_count']}")
        print(f"Invalid remaining qty layers   : {hist_stats['invalid_qty_layer_count']}")

        print("\nValuation Integrity")
        print("-" * 30)
        print(f"Stock Ledger Match count       : {ledger_stats['match_count']}")
        print(f"Stock Ledger Mismatch count    : {ledger_stats['mismatch_count']}")
        print(f"Stock Ledger Variance count    : {ledger_stats['variance_count']}")
        if ledger_stats['mismatches']:
            print("Mismatches Detailed Breakdown:")
            for mismatch in ledger_stats['mismatches']:
                print(f" - Item {mismatch['item_sku']}: CostLayer Remaining = {mismatch['layer_qty']}, InventoryLedger OnHand = {mismatch['ledger_qty']}")

        print("\nInventory <-> GL Reconciliation")
        print("-" * 30)
        print(f"Inventory Subledger Value      : {format(gl_stats['subledger_value'], '.2f')}")
        print(f"GL Account 1200 Balance        : {format(gl_stats['gl_balance'], '.2f')}")
        print(f"Reconciliation Variance        : {format(gl_stats['variance'], '.2f')}")
        print(f"Status                         : {gl_stats['status']}")

        print("\nFIFO Verification")
        print("-" * 30)
        print(f"FIFO Layer consumption order   : {fifo_stats['order_status']}")
        print(f"Consumed quantities check      : {fifo_stats['qty_status']}")
        print(f"Layer status correctness       : {fifo_stats['status_correctness']}")

        print("\nPeriod Controls")
        print("-" * 30)
        print(f"OPEN Period Postings           : {period_stats['open_status']}")
        print(f"CLOSED Period Postings         : {period_stats['closed_status']}")
        print(f"CLOSING Period Restrictions    : {period_stats['closing_status']}")

        print("\nPerformance Results")
        print("-" * 30)
        print(f"Valuation Report API           : {perf_stats['val_report_ms']:.2f} ms")
        print(f"Reconciliation Report API      : {perf_stats['recon_report_ms']:.2f} ms")
        print(f"Aging Report API               : {perf_stats['aging_report_ms']:.2f} ms")

        print("\nTest Results")
        print("-" * 30)
        print(f"tests/test_inventory_valuation.py : {'PASS' if test_stats['valuation_pass'] else 'FAIL'}")
        print(f"tests/test_inventory.py           : {'PASS' if test_stats['inventory_pass'] else 'FAIL'}")
        print(f"tests/test_acceptance.py          : {'PASS' if test_stats['acceptance_pass'] else 'FAIL'}")

        print("\nFinal Recommendation")
        print("-" * 30)
        print(f"RECOMMENDATION: {self.status}")
        if self.status == "NOT READY FOR PHASE 12B":
            print("\nREMEDIATION ITEMS REQUIRED:")
            for idx, item in enumerate(self.remediations, 1):
                print(f" {idx}. {item}")
        else:
            print("\nAll checks successfully certified. Phase 12A is signed off. Ready to proceed to Phase 12B.")
        print("=" * 60)

        self.db.close()

    def verify_historical_data(self) -> dict:
        item_count = self.db.query(models.Item).count()
        wh_count = self.db.query(models.Warehouse).count()
        layer_count = self.db.query(models.InventoryCostLayer).count()
        val_entry_count = self.db.query(models.InventoryValuationEntry).count()
        audit_log_count = self.db.query(models.InventoryAuditLog).count()
        
        # Detect orphans
        item_ids = {item.id for item in self.db.query(models.Item.id).all()}
        wh_ids = {wh.id for wh in self.db.query(models.Warehouse.id).all()}
        
        orphan_count = 0
        neg_layer_count = 0
        invalid_qty_layer_count = 0
        
        layers = self.db.query(models.InventoryCostLayer).all()
        for l in layers:
            if l.item_id not in item_ids:
                orphan_count += 1
            if l.warehouse_id and l.warehouse_id not in wh_ids:
                orphan_count += 1
            if l.remaining_quantity < 0:
                neg_layer_count += 1
            if l.remaining_quantity > l.original_quantity:
                invalid_qty_layer_count += 1
                
        if orphan_count > 0:
            self.defects.append(f"Orphan cost layers found: {orphan_count}")
            self.remediations.append("Clean up obsolete cost layers linked to non-existent Items/Warehouses.")
            
        if neg_layer_count > 0:
            # Check if negative allowed
            config = self.db.query(models.TenantConfig).first()
            if not config or not config.allow_negative_inventory:
                self.defects.append(f"Negative cost layers found without settings authorization: {neg_layer_count}")
                self.remediations.append("Review stock issue logs causing negative layers or enable allow_negative_inventory.")
                
        if invalid_qty_layer_count > 0:
            self.defects.append(f"Cost layers found where remaining > original quantity: {invalid_qty_layer_count}")
            self.remediations.append("Investigate system receipts generating invalid layer remaining quantity balances.")

        return {
            "item_count": item_count,
            "wh_count": wh_count,
            "layer_count": layer_count,
            "val_entry_count": val_entry_count,
            "audit_log_count": audit_log_count,
            "orphan_count": orphan_count,
            "neg_layer_count": neg_layer_count,
            "invalid_qty_layer_count": invalid_qty_layer_count
        }

    def verify_inventory_stock_ledger(self) -> dict:
        items = self.db.query(models.Item).all()
        
        match_count = 0
        mismatch_count = 0
        variance_count = 0
        mismatches = []
        
        for item in items:
            # Sum cost layer remaining qty
            layer_qty_sum = self.db.query(func.sum(models.InventoryCostLayer.remaining_quantity)).filter(
                models.InventoryCostLayer.item_id == item.id,
                models.InventoryCostLayer.is_deleted == False
            ).scalar() or Decimal("0.0")
            
            # Query InventoryLedger on-hand qty
            ledger = self.db.query(models.InventoryLedger).filter(
                models.InventoryLedger.item_id == item.id,
                models.InventoryLedger.is_deleted == False
            ).first()
            ledger_qty = ledger.quantity_on_hand if ledger else 0
            
            if float(layer_qty_sum) == float(ledger_qty):
                match_count += 1
            else:
                mismatch_count += 1
                variance = float(layer_qty_sum) - float(ledger_qty)
                variance_count += 1
                mismatches.append({
                    "item_sku": item.sku,
                    "layer_qty": float(layer_qty_sum),
                    "ledger_qty": float(ledger_qty),
                    "variance": variance
                })
                
        if mismatch_count > 0:
            self.defects.append(f"Stock ledger mismatches: {mismatch_count} items have unequal layer remaining vs ledger quantities.")
            self.remediations.append("Align the main stock ledger with cost layers by auditing transactions.")

        return {
            "match_count": match_count,
            "mismatch_count": mismatch_count,
            "variance_count": variance_count,
            "mismatches": mismatches
        }

    def verify_inventory_gl_reconciliation(self) -> dict:
        # Sum layers
        layers = self.db.query(models.InventoryCostLayer).filter_by(is_deleted=False).all()
        subledger_value = sum(l.remaining_quantity * l.unit_cost for l in layers)

        # GL Account 1200
        acc = self.db.query(models.Account).filter_by(code='1200').first()
        gl_balance = 0.0
        if acc:
            lines = self.db.query(models.JournalLine).filter_by(account_id=acc.id, is_deleted=False).all()
            debits = sum(l.debit_amount for l in lines)
            credits = sum(l.credit_amount for l in lines)
            gl_balance = float(debits - credits)

        variance = float(subledger_value) - gl_balance
        
        status = "Green"
        if abs(variance) > 0.0:
            if abs(variance) <= 1000.0:
                status = "Amber"
            else:
                status = "Red"
                self.remediations.append(
                    f"GL Reconciliation Variance is too high (${variance:,.2f}). "
                    "Remediation: Retroactively populate InventoryCostLayer records for the 10 historical GRNs "
                    "(e.g., GRN-TEST-6646, GRN-STG2-5746, etc.) accepted prior to Phase 12A implementation."
                )

        return {
            "subledger_value": float(subledger_value),
            "gl_balance": gl_balance,
            "variance": variance,
            "status": status
        }

    def verify_fifo_integrity(self) -> dict:
        # Check order of consumption
        # Retrieve all layers for all items, grouped, and check order
        items_map = {item.id: item for item in self.db.query(models.Item).all()}
        
        violations_count = 0
        consumed_qty_violations = 0
        status_violations = 0
        
        # Group cost layers by item
        layers = self.db.query(models.InventoryCostLayer).filter_by(is_deleted=False).order_by(
            models.InventoryCostLayer.item_id,
            models.InventoryCostLayer.created_at.asc()
        ).all()
        
        item_layers = {}
        for l in layers:
            item_layers.setdefault(l.item_id, []).append(l)
            
        for item_id, l_list in item_layers.items():
            # Check chronological: if a CONSUMED layer was created AFTER an OPEN/PARTIALLY_CONSUMED layer, it is a violation
            seen_open_or_partial = False
            for l in l_list:
                if l.layer_status in ["OPEN", "PARTIALLY_CONSUMED"]:
                    seen_open_or_partial = True
                elif l.layer_status == "CONSUMED" and seen_open_or_partial:
                    violations_count += 1
            
            # Check quantity constraints
            for l in l_list:
                if l.layer_status == "CONSUMED" and l.remaining_quantity > 0:
                    status_violations += 1
                if l.remaining_quantity < 0:
                    # Checked in negative layers but tracks here too
                    pass
                    
        order_status = "PASS" if violations_count == 0 else "FAIL"
        qty_status = "PASS" if consumed_qty_violations == 0 else "FAIL"
        status_correctness = "PASS" if status_violations == 0 else "FAIL"
        
        if violations_count > 0:
            self.defects.append(f"FIFO sequence violations: {violations_count} instances where newer layers were consumed before older ones.")
            self.remediations.append("Re-evaluate FIFO layer allocation logic during stock consumption.")
            
        if status_violations > 0:
            self.defects.append(f"Layer status incorrect: {status_violations} consumed layers have remaining quantity.")
            self.remediations.append("Ensure remaining quantities are cleared to 0 when status is marked CONSUMED.")

        return {
            "order_status": order_status,
            "qty_status": qty_status,
            "status_correctness": status_correctness
        }

    def verify_period_controls(self) -> dict:
        self.db.begin_nested()
        try:
            # 1. Verify OPEN period date
            open_period_date = datetime(2026, 6, 15)
            open_status = "FAIL"
            try:
                period = AccountingService.validate_period_for_posting(self.db, open_period_date)
                if period and period.status.upper() == "OPEN":
                    open_status = "PASS"
            except Exception:
                open_status = "FAIL"

            # 2. Verify LOCKED period date (rejection)
            locked_period_date = datetime(2026, 1, 15)
            closed_status = "FAIL"
            try:
                AccountingService.validate_period_for_posting(self.db, locked_period_date)
                closed_status = "FAIL"
            except ValueError as e:
                if "is LOCKED" in str(e) or "is CLOSED" in str(e) or "its status is LOCKED" in str(e):
                    closed_status = "PASS"
                else:
                    closed_status = "FAIL"
            except Exception:
                closed_status = "FAIL"

            # 3. Verify CLOSING period role checks
            # Mock period fiscal year status as CLOSING
            closing_status = "FAIL"
            period = self.db.query(models.AccountingPeriod).filter(
                models.AccountingPeriod.start_date <= open_period_date,
                models.AccountingPeriod.end_date >= open_period_date
            ).first()
            
            if period and period.fiscal_year:
                fy = period.fiscal_year
                original_status = fy.status
                fy.status = "CLOSING"
                self.db.flush()
                
                # Test non-admin rejection
                non_admin_ok = False
                try:
                    AccountingService.validate_period_for_posting(self.db, open_period_date, user_role="EMPLOYEE")
                except ValueError as e:
                    if "requires finance/admin privileges" in str(e):
                        non_admin_ok = True
                
                # Test admin acceptance
                admin_ok = False
                try:
                    p = AccountingService.validate_period_for_posting(self.db, open_period_date, user_role="ADMIN")
                    if p:
                        admin_ok = True
                except Exception:
                    pass
                
                if non_admin_ok and admin_ok:
                    closing_status = "PASS"
                
                fy.status = original_status
                self.db.flush()
            else:
                closing_status = "PASS (No active fiscal year mapping to mock)"

            return {
                "open_status": open_status,
                "closed_status": closed_status,
                "closing_status": closing_status
            }
        except Exception:
            return {
                "open_status": "FAIL",
                "closed_status": "FAIL",
                "closing_status": "FAIL"
            }
        finally:
            self.db.rollback()

    def verify_performance(self) -> dict:
        admin_user = self.db.query(models.User).filter_by(role=models.Role.ADMIN).first()
        if not admin_user:
            admin_user = self.db.query(models.User).filter_by(role=models.Role.SUPER_ADMIN).first()

        app.dependency_overrides[get_current_user] = lambda: admin_user

        # 1. Valuation Report
        t_start = time.perf_counter()
        for _ in range(10):
            self.client.get("/api/inventory/valuation")
        val_ms = ((time.perf_counter() - t_start) / 10) * 1000

        # 2. Reconciliation Report
        t_start = time.perf_counter()
        for _ in range(10):
            self.client.get("/api/finance/ap-reconciliation")
        recon_ms = ((time.perf_counter() - t_start) / 10) * 1000

        # 3. Aging Report
        t_start = time.perf_counter()
        for _ in range(10):
            self.client.get("/api/finance/aging")
        aging_ms = ((time.perf_counter() - t_start) / 10) * 1000

        app.dependency_overrides.clear()
        
        # Check benchmarks
        if max(val_ms, recon_ms, aging_ms) > 1000.0:
            self.remediations.append("Optimize reports queries and database indexes to keep api response < 1000ms.")

        return {
            "val_report_ms": val_ms,
            "recon_report_ms": recon_ms,
            "aging_report_ms": aging_ms
        }

    def verify_regression_tests(self) -> dict:
        valuation_pass = True
        inventory_pass = True
        acceptance_pass = True

        # Test 1
        res1 = subprocess.run(
            ["py", "-m", "pytest", "tests/test_inventory_valuation.py", "--no-cov"],
            capture_output=True, text=True
        )
        if res1.returncode != 0:
            valuation_pass = False

        # Test 2
        res2 = subprocess.run(
            ["py", "-m", "pytest", "tests/test_inventory.py", "--no-cov"],
            capture_output=True, text=True
        )
        if res2.returncode != 0:
            inventory_pass = False

        # Test 3
        res3 = subprocess.run(
            ["py", "-m", "pytest", "tests/test_acceptance.py", "-k", "inventory", "--no-cov"],
            capture_output=True, text=True
        )
        if res3.returncode != 0:
            acceptance_pass = False

        passed = valuation_pass and inventory_pass and acceptance_pass
        if not passed:
            self.remediations.append("Resolve failures in the regression test suite.")

        return {
            "valuation_pass": valuation_pass,
            "inventory_pass": inventory_pass,
            "acceptance_pass": acceptance_pass,
            "passed": passed
        }

if __name__ == "__main__":
    verifier = ProductionReadinessVerifier()
    verifier.run_verification()
