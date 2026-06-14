import sys
import os
import time
import subprocess
import uuid
from decimal import Decimal
from datetime import datetime

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend import models, database, inventory_engine
from backend.main import app
from backend.dependencies import get_current_user

class InventoryAuditRunner:
    def __init__(self):
        self.db = database.SessionLocal()
        self.client = TestClient(app)
        self.results = {}
        self.defects = []
        self.recommendations = []
        
        # Ensure default tenant is seeded permanently to support foreign keys
        self.seed_default_tenant_if_missing()

    def seed_default_tenant_if_missing(self):
        try:
            tenant_uuid = models.SYSTEM_DEFAULT_TENANT_UUID
            tenant = self.db.query(models.Tenant).filter_by(id=tenant_uuid).first()
            if not tenant:
                print(f" -> Default Tenant missing in database. Seeding ID: {tenant_uuid}")
                tenant = models.Tenant(
                    id=tenant_uuid,
                    name="Default System Tenant",
                    domain="system",
                    status="ACTIVE"
                )
                self.db.add(tenant)
                self.db.commit()
                print(" -> Default Tenant successfully seeded in database.")
            else:
                print(f" -> Default Tenant found in database (ID: {tenant_uuid}).")
        except Exception as e:
            self.db.rollback()
            print(f" -> Warning: Failed to seed default tenant: {e}")

    def run_all(self):
        print("=" * 60)
        print("STARTING INVENTORY FOUNDATION AUDIT (PHASE 12A)")
        print("=" * 60)

        # 1. Database Integrity
        self.results["Database Integrity"] = self.audit_database_integrity()

        # 2. FIFO Verification
        self.results["FIFO Verification"] = self.audit_fifo_verification()

        # 3. Inventory Valuation Integrity
        self.results["Inventory Valuation Integrity"] = self.audit_valuation_integrity()

        # 4. Settings Validation
        self.results["Settings Validation"] = self.audit_settings_validation()

        # 5. API Validation
        self.results["API Validation"] = self.audit_api_validation()

        # 6. Frontend Validation
        self.results["Frontend Validation"] = self.audit_frontend_validation()

        # 7. Performance Benchmarks
        self.results["Performance"] = self.audit_performance()

        # 8. Test Verification
        self.results["Test Verification"] = self.audit_test_verification()

        print("\n" + "=" * 60)
        print("AUDIT RESULTS SUMMARY")
        print("=" * 60)
        
        all_passed = True
        for section, passed in self.results.items():
            status = "PASS" if passed else "FAIL"
            if not passed:
                all_passed = False
            print(f"{section:<35}: {status}")

        print("\n" + "=" * 60)
        if self.defects:
            print("IDENTIFIED DEFECTS:")
            for idx, defect in enumerate(self.defects, 1):
                print(f"{idx}. {defect}")
        else:
            print("IDENTIFIED DEFECTS: None")

        if self.recommendations:
            print("\nRECOMMENDED FIXES:")
            for idx, rec in enumerate(self.recommendations, 1):
                print(f"{idx}. {rec}")
        
        print("\n" + "=" * 60)
        recommendation_status = "GO" if all_passed else "NO-GO"
        print(f"RECOMMENDATION: {recommendation_status}")
        print("=" * 60)

        self.db.close()
        
        # Exit with appropriate code
        sys.exit(0 if all_passed else 1)

    def audit_database_integrity(self) -> bool:
        print("\n[1/8] Auditing Database Integrity...")
        try:
            layer_count = self.db.query(models.InventoryCostLayer).count()
            val_entry_count = self.db.query(models.InventoryValuationEntry).count()
            audit_log_count = self.db.query(models.InventoryAuditLog).count()
            
            print(f" -> InventoryCostLayer Count: {layer_count}")
            print(f" -> InventoryValuationEntry Count: {val_entry_count}")
            print(f" -> InventoryAuditLog Count: {audit_log_count}")

            # Check Orphan cost layers (item_id or warehouse_id not existing)
            item_ids = {item.id for item in self.db.query(models.Item.id).all()}
            wh_ids = {wh.id for wh in self.db.query(models.Warehouse.id).all()}

            orphan_layers = 0
            negative_layers_when_disabled = 0
            
            layers = self.db.query(models.InventoryCostLayer).all()
            for l in layers:
                if l.item_id not in item_ids:
                    orphan_layers += 1
                if l.warehouse_id and l.warehouse_id not in wh_ids:
                    orphan_layers += 1

            # Check Negative quantities when disabled globally
            tenant_configs = self.db.query(models.TenantConfig).all()
            # If default allow_negative is False, check for any remaining_quantity < 0
            for config in tenant_configs:
                if not config.allow_negative_inventory:
                    negs = self.db.query(models.InventoryCostLayer).filter(
                        models.InventoryCostLayer.tenant_id == config.tenant_uuid,
                        models.InventoryCostLayer.remaining_quantity < 0
                    ).count()
                    if negs > 0:
                        negative_layers_when_disabled += negs

            if orphan_layers > 0:
                self.defects.append(f"Found {orphan_layers} orphan InventoryCostLayers referring to non-existent Items or Warehouses.")
                self.recommendations.append("Execute database cleanup of orphan inventory cost layers.")
                return False

            if negative_layers_when_disabled > 0:
                self.defects.append(f"Found {negative_layers_when_disabled} negative cost layers under tenants where allow_negative_inventory is disabled.")
                self.recommendations.append("Verify inventory adjustments or enable allow_negative_inventory settings.")
                return False

            print(" -> DB integrity checks passed. No orphans or illegal negative levels detected.")
            return True
        except Exception as e:
            self.defects.append(f"Database integrity query failure: {e}")
            return False

    def audit_fifo_verification(self) -> bool:
        print("\n[2/8] Auditing FIFO Verification...")
        # We perform FIFO receipts and consumption inside a transaction and rollback
        self.db.begin_nested()
        try:
            # Create test user, item, warehouse
            test_user = self.db.query(models.User).filter_by(role=models.Role.ADMIN).first()
            if not test_user:
                test_user = models.User(
                    username="audit_admin",
                    email="audit@example.com",
                    hashed_password="hashed",
                    role=models.Role.ADMIN
                )
                self.db.add(test_user)
                self.db.flush()

            test_item = models.Item(
                sku=f"AUDIT-SKU-{uuid.uuid4().hex[:6].upper()}",
                name="Audit Item",
                category="Raw Material",
                uom="pcs",
                unit_price=Decimal("10.00"),
                standard_rate=Decimal("10.00")
            )
            self.db.add(test_item)
            
            test_wh = models.Warehouse(
                name="Audit Warehouse",
                warehouse_code=f"AUD-WH-{uuid.uuid4().hex[:4].upper()}"
            )
            self.db.add(test_wh)
            self.db.flush()

            # Ensure setting costing = FIFO
            config = self.db.query(models.TenantConfig).first()
            if not config:
                config = models.TenantConfig(
                    tenant_uuid=models.SYSTEM_DEFAULT_TENANT_UUID,
                    inventory_costing_method="FIFO",
                    allow_negative_inventory=False
                )
                self.db.add(config)
            else:
                config.inventory_costing_method = "FIFO"
                config.allow_negative_inventory = False
            self.db.flush()

            # Receipt 1: 10 units @ 5.00
            inventory_engine.record_receipt(
                db=self.db, item_id=test_item.id, warehouse_id=test_wh.id,
                qty=10, unit_cost=Decimal("5.00"), reference_type="MANUAL", user_id=test_user.id
            )
            # Receipt 2: 20 units @ 6.00
            inventory_engine.record_receipt(
                db=self.db, item_id=test_item.id, warehouse_id=test_wh.id,
                qty=20, unit_cost=Decimal("6.00"), reference_type="MANUAL", user_id=test_user.id
            )
            self.db.flush()

            # Issue 15 units. FIFO should consume:
            # - 10 from layer 1 @ 5.00
            # - 5 from layer 2 @ 6.00
            # Total cost issued: 50.00 + 30.00 = 80.00. Avg cost = 80.00 / 15 = 5.3333
            avg_cost = inventory_engine.consume_cost_layers(
                db=self.db, item_id=test_item.id, warehouse_id=test_wh.id,
                qty_to_issue=Decimal("15.00"), fallback_cost=Decimal("6.00"),
                reference_type="MANUAL", reference_id=None, user_id=test_user.id
            )
            self.db.flush()

            # Verify calculations
            expected_avg = Decimal("80.00") / Decimal("15.00")
            if round(avg_cost, 4) != round(expected_avg, 4):
                self.defects.append(f"FIFO verification failed. Cost expected {expected_avg:.4f}, got {avg_cost:.4f}")
                return False

            # Verify layers
            layers = self.db.query(models.InventoryCostLayer).filter_by(item_id=test_item.id).order_by(models.InventoryCostLayer.created_at.asc()).all()
            if len(layers) != 2:
                self.defects.append("FIFO verification: Cost layers count mismatch.")
                return False

            # Oldest layer must be fully consumed
            if layers[0].remaining_quantity != 0 or layers[0].layer_status != "CONSUMED" or not layers[0].consumed_at:
                self.defects.append("FIFO oldest layer not marked correctly as CONSUMED.")
                return False

            # Newest layer must be partially consumed
            if layers[1].remaining_quantity != 15 or layers[1].layer_status != "PARTIALLY_CONSUMED":
                self.defects.append(f"FIFO second layer remaining quantity mismatch. Expected 15, got {layers[1].remaining_quantity}")
                return False

            # Verify remaining <= original
            for l in layers:
                if l.remaining_quantity > l.original_quantity:
                    self.defects.append("FIFO layer remaining quantity exceeds original quantity.")
                    return False

            print(" -> FIFO logic verification successfully passed.")
            return True
        except Exception as e:
            self.defects.append(f"FIFO logic test exception: {e}")
            return False
        finally:
            self.db.rollback()

    def audit_valuation_integrity(self) -> bool:
        print("\n[3/8] Auditing Inventory Valuation Integrity...")
        try:
            # Query non-deleted layers with remaining stock
            layers = self.db.query(models.InventoryCostLayer).filter(
                models.InventoryCostLayer.remaining_quantity != 0,
                models.InventoryCostLayer.is_deleted == False
            ).all()

            calculated_total = Decimal("0.0")
            for layer in layers:
                calculated_total += layer.remaining_quantity * layer.unit_cost

            # Call valuation API (mock admin auth)
            admin_user = self.db.query(models.User).filter_by(role=models.Role.ADMIN).first()
            if not admin_user:
                admin_user = self.db.query(models.User).filter_by(role=models.Role.SUPER_ADMIN).first()
            
            if not admin_user:
                self.defects.append("No Admin or Super Admin user found in DB to mock authentication.")
                return False

            app.dependency_overrides[get_current_user] = lambda: admin_user
            res = self.client.get("/api/inventory/valuation")
            app.dependency_overrides.clear()

            if res.status_code != 200:
                self.defects.append(f"Valuation API returned status code {res.status_code}")
                return False

            api_total = res.json().get("company_total_value", 0.0)
            variance = abs(float(calculated_total) - api_total)

            print(f" -> Direct Layers Recalculation: {float(calculated_total):.4f}")
            print(f" -> API Report Total           : {api_total:.4f}")
            print(f" -> Computed Variance          : {variance:.4f}")

            if variance > 1e-4:
                self.defects.append(f"Valuation total mismatch. Layers recalculation: {float(calculated_total)}, API total: {api_total}. Variance: {variance}")
                self.recommendations.append("Ensure rounding and aggregation rules align between the API router and raw layer storage.")
                return False

            print(" -> Valuation integrity check passed. Variance equals 0.")
            return True
        except Exception as e:
            self.defects.append(f"Valuation integrity check failed: {e}")
            return False

    def audit_settings_validation(self) -> bool:
        print("\n[4/8] Auditing Settings Validation...")
        self.db.begin_nested()
        try:
            config = self.db.query(models.TenantConfig).first()
            if not config:
                config = models.TenantConfig(
                    tenant_uuid=models.SYSTEM_DEFAULT_TENANT_UUID,
                    inventory_costing_method="FIFO",
                    allow_negative_inventory=False
                )
                self.db.add(config)
                self.db.flush()

            # Test Costco method changes persist
            config.inventory_costing_method = "WAC"
            config.allow_negative_inventory = True
            self.db.flush()

            db_config = self.db.query(models.TenantConfig).filter_by(tenant_uuid=config.tenant_uuid).first()
            if db_config.inventory_costing_method != "WAC" or not db_config.allow_negative_inventory:
                self.defects.append("TenantConfig costing modifications did not persist in database.")
                return False

            # Test Role restrictions (Simulate non-admin role)
            regular_user = models.User(
                username="regular_worker",
                email="worker@example.com",
                hashed_password="hashed",
                role=models.Role.EMPLOYEE
            )
            self.db.add(regular_user)
            self.db.flush()

            app.dependency_overrides[get_current_user] = lambda: regular_user
            payload = {
                "inventory_costing_method": "FIFO",
                "allow_negative_inventory": False
            }
            res = self.client.post("/api/inventory/settings", json=payload)
            app.dependency_overrides.clear()

            if res.status_code != 403:
                self.defects.append(f"Settings updates failed role restriction check. Expected 403, got {res.status_code}")
                self.recommendations.append("Verify role check checks in update_inventory_settings router method.")
                return False

            print(" -> Settings persistence and role restriction validation passed.")
            return True
        except Exception as e:
            self.defects.append(f"Settings validation failed: {e}")
            return False
        finally:
            self.db.rollback()

    def audit_api_validation(self) -> bool:
        print("\n[5/8] Auditing API Validation (Authentication, Schemas, Serialization)...")
        try:
            # 1. Verify Authentication Enforcement
            res_get = self.client.get("/api/inventory/settings")
            if res_get.status_code != 401:
                self.defects.append(f"GET /settings did not enforce auth. Status: {res_get.status_code}")
                return False

            res_val = self.client.get("/api/inventory/valuation")
            if res_val.status_code != 401:
                self.defects.append(f"GET /valuation did not enforce auth. Status: {res_val.status_code}")
                return False

            # 2. Mock auth and verify Schema Serialization
            admin_user = self.db.query(models.User).filter_by(role=models.Role.ADMIN).first()
            if not admin_user:
                admin_user = self.db.query(models.User).filter_by(role=models.Role.SUPER_ADMIN).first()
            
            app.dependency_overrides[get_current_user] = lambda: admin_user
            
            # GET /settings
            res_settings = self.client.get("/api/inventory/settings")
            if res_settings.status_code != 200:
                self.defects.append(f"GET /settings failed: {res_settings.status_code}")
                return False
            data = res_settings.json()
            if "inventory_costing_method" not in data or "allow_negative_inventory" not in data:
                self.defects.append("GET /settings serialization schema mismatch.")
                return False

            # POST /settings (invalid parameters schema test)
            res_post_bad = self.client.post("/api/inventory/settings", json={"invalid_field": True})
            if res_post_bad.status_code != 422:
                self.defects.append(f"POST /settings accepted invalid schema parameter. Status: {res_post_bad.status_code}")
                return False

            app.dependency_overrides.clear()
            print(" -> API endpoints and schema serialization correctly validated.")
            return True
        except Exception as e:
            self.defects.append(f"API endpoints validation exception: {e}")
            return False

    def audit_frontend_validation(self) -> bool:
        print("\n[6/8] Auditing Frontend Route Configuration...")
        try:
            routes_config_path = "frontend/src/routes/routes.config.ts"
            app_tsx_path = "frontend/src/App.tsx"

            if not os.path.exists(routes_config_path):
                self.defects.append("routes.config.ts file does not exist.")
                return False

            if not os.path.exists(app_tsx_path):
                self.defects.append("App.tsx file does not exist.")
                return False

            # Read and verify route is configured
            with open(routes_config_path, "r", encoding="utf-8") as f:
                routes_content = f.read()

            if "/inventory/valuation" not in routes_content:
                self.defects.append("Route '/inventory/valuation' not registered in routes.config.ts")
                return False

            # Read and verify page lazy load/route mapping is present
            with open(app_tsx_path, "r", encoding="utf-8") as f:
                app_content = f.read()

            if "inventory/InventoryValuation" not in app_content and "pages/inventory/InventoryValuation" not in app_content:
                self.defects.append("InventoryValuation page import or lazy load not present in App.tsx")
                return False

            if "/inventory/valuation" not in app_content:
                self.defects.append("Route path='/inventory/valuation' not defined in App.tsx routing list")
                return False

            print(" -> Frontend route configurations successfully verified.")
            return True
        except Exception as e:
            self.defects.append(f"Frontend route files validation failed: {e}")
            return False

    def audit_performance(self) -> bool:
        print("\n[7/8] Running Performance Benchmarks (Limit < 500ms)...")
        try:
            admin_user = self.db.query(models.User).filter_by(role=models.Role.ADMIN).first()
            if not admin_user:
                admin_user = self.db.query(models.User).filter_by(role=models.Role.SUPER_ADMIN).first()

            app.dependency_overrides[get_current_user] = lambda: admin_user

            # Benchmark 1: Valuation API report execution
            t_start = time.perf_counter()
            for _ in range(50):
                res = self.client.get("/api/inventory/valuation")
            t_end = time.perf_counter()
            val_avg_ms = ((t_end - t_start) / 50) * 1000
            print(f" -> Valuation Report API average: {val_avg_ms:.2f} ms")

            # Benchmark 2: Settings GET API
            t_start = time.perf_counter()
            for _ in range(50):
                res = self.client.get("/api/inventory/settings")
            t_end = time.perf_counter()
            settings_avg_ms = ((t_end - t_start) / 50) * 1000
            print(f" -> Settings Retrieve API average: {settings_avg_ms:.2f} ms")

            app.dependency_overrides.clear()

            # Performance threshold checks
            if val_avg_ms > 500.0:
                self.defects.append(f"Valuation report avg performance exceeded 500ms limit: {val_avg_ms:.2f}ms")
                return False

            if settings_avg_ms > 500.0:
                self.defects.append(f"Settings Retrieval avg performance exceeded 500ms limit: {settings_avg_ms:.2f}ms")
                return False

            print(" -> Performance check passed. Execution averages are well within < 500ms limit.")
            return True
        except Exception as e:
            self.defects.append(f"Performance benchmarking execution exception: {e}")
            return False

    def audit_test_verification(self) -> bool:
        print("\n[8/8] Verifying Test Suite (py -m pytest)...")
        try:
            # Run pytest command
            res = subprocess.run(
                ["py", "-m", "pytest", "tests/test_inventory_valuation.py", "--no-cov"],
                capture_output=True,
                text=True
            )
            
            print(res.stdout)
            if res.returncode != 0:
                self.defects.append(f"Pytest suite run returned non-zero code {res.returncode}. Stderr: {res.stderr}")
                return False

            print(" -> Test verification successfully passed.")
            return True
        except Exception as e:
            self.defects.append(f"Failed to execute pytest process programmatically: {e}")
            return False


if __name__ == "__main__":
    runner = InventoryAuditRunner()
    runner.run_all()
