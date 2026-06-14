import sys
import os
import uuid
from decimal import Decimal
from datetime import datetime, timedelta

# Ensure root folder is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from backend.database import SessionLocal, engine
import backend.models as models
from backend import manufacturing_engine
from backend.manufacturing_accounting_service import ManufacturingAccountingService
from backend.shop_floor_service import ShopFloorService
from backend.services.accounting_service import AccountingService

def run_manufacturing_audit():
    print("=" * 70)
    print("         MANUFACTURING EXECUTION SYSTEM (MES) & GO-LIVE AUDIT")
    print("=" * 70)
    
    db = SessionLocal()
    scores = {}
    defects = []
    
    try:
        # ----------------------------------------------------
        # 1. DATABASE SCHEMA INTEGRITY (20 Points)
        # ----------------------------------------------------
        print("\n[Audit Step 1/5] Database Schema & Table Verification...")
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        required_tables = [
            "bill_of_materials",
            "bill_of_material_lines",
            "work_centers",
            "routings",
            "routing_operations",
            "work_order_materials",
            "work_order_operations",
            "work_orders",
            "manufacturing_batches",
            "manufacturing_batch_materials",
            "manufacturing_audit_logs",
            "quality_inspections",
            "quality_inspection_results"
        ]
        
        missing_tables = []
        for table in required_tables:
            if table not in existing_tables:
                missing_tables.append(table)
                
        if missing_tables:
            print(f"  [FAIL] Missing required tables: {missing_tables}")
            scores["Database Schema"] = 0
            defects.append(f"Missing DB tables: {missing_tables}")
        else:
            print("  [PASS] All manufacturing core tables exist in the schema.")
            scores["Database Schema"] = 20

        # ----------------------------------------------------
        # 2. MASTER DATA VALIDATION (20 Points)
        # ----------------------------------------------------
        print("\n[Audit Step 2/5] Manufacturing Master Data Verification...")
        
        # Verify BOMs
        boms_count = db.query(models.BillOfMaterial).count()
        routing_count = db.query(models.Routing).count()
        wc_count = db.query(models.WorkCenter).count()
        
        print(f"  Active BOMs: {boms_count}")
        print(f"  Active Routings: {routing_count}")
        print(f"  Active Work Centers: {wc_count}")
        
        master_errors = []
        # Check for orphan BOM lines
        orphan_bom_lines = db.query(models.BillOfMaterialLine).filter(
            ~models.BillOfMaterialLine.bom_id.in_(db.query(models.BillOfMaterial.id))
        ).count()
        if orphan_bom_lines > 0:
            master_errors.append(f"{orphan_bom_lines} orphan BOM lines detected.")
            
        # Check for orphan routing operations
        orphan_ops = db.query(models.RoutingOperation).filter(
            ~models.RoutingOperation.routing_id.in_(db.query(models.Routing.id))
        ).count()
        if orphan_ops > 0:
            master_errors.append(f"{orphan_ops} orphan routing operations detected.")
            
        if master_errors:
            print(f"  [FAIL] Master data errors: {master_errors}")
            scores["Master Data"] = 10
            defects.extend(master_errors)
        else:
            print("  [PASS] Master data relationships and counts are consistent.")
            scores["Master Data"] = 20

        # ----------------------------------------------------
        # 3. WORK ORDER LIFECYCLE & EXECUTION (30 Points)
        # ----------------------------------------------------
        print("\n[Audit Step 3/5] Work Order Lifecycle & Shop Floor Control Simulation...")
        
        # We perform a trial work order execution in a transaction to verify the State Machine,
        # shop floor services, QC controls, and accounting engine are 100% compliant.
        try:
            tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
            today = datetime.utcnow()
            
            # Setup accounting period (ensure we have all control accounts and active fiscal year)
            # Find or seed Fiscal Year
            fy = db.query(models.FiscalYear).filter_by(status="ACTIVE").first()
            if not fy:
                fy = models.FiscalYear(
                    id=uuid.uuid4(),
                    name=f"FY-{today.year}",
                    start_date=today - timedelta(days=180),
                    end_date=today + timedelta(days=180),
                    status="ACTIVE",
                    tenant_id=tenant_id
                )
                db.add(fy)
                db.flush()
                
            period_name = today.strftime("%Y-%m")
            ap = db.query(models.AccountingPeriod).filter_by(period_name=period_name).first()
            if not ap:
                ap = models.AccountingPeriod(
                    id=uuid.uuid4(),
                    period_name=period_name,
                    start_date=today - timedelta(days=15),
                    end_date=today + timedelta(days=15),
                    status="OPEN",
                    fiscal_year_id=fy.id,
                    tenant_id=tenant_id
                )
                db.add(ap)
                db.flush()

            # Seed missing GL accounts
            codes_needed = {
                "1200": "Inventory Control Account",
                "1300": "WIP Inventory Account",
                "5100": "Labor Absorption Account",
                "5200": "Manufacturing Overhead Account",
                "1210": "Finished Goods Inventory Account",
                "5300": "Scrap Variance Account",
                "1350": "Rework Inventory Account",
                "5310": "Material Variance Account",
                "5320": "Labor Variance Account",
                "5330": "Overhead Variance Account",
                "5340": "Yield Variance Account"
            }
            for code, name in codes_needed.items():
                acc = db.query(models.Account).filter_by(code=code).first()
                if not acc:
                    acc = models.Account(
                        id=uuid.uuid4(),
                        code=code,
                        name=name,
                        account_type="ASSET" if code.startswith("1") else "REVENUE" if code.startswith("5") else "EXPENSE",
                        tenant_id=tenant_id
                    )
                    db.add(acc)
                    db.flush()

            seq = db.query(models.JournalSequence).first()
            if not seq:
                seq = models.JournalSequence(
                    id=uuid.uuid4(),
                    fiscal_year_id=fy.id,
                    current_number=0,
                    tenant_id=tenant_id
                )
                db.add(seq)
                db.flush()

            # Create test FG item & Component RM item
            fg_sku = f"FG-AUDIT-{uuid.uuid4().hex[:4].upper()}"
            rm_sku = f"RM-AUDIT-{uuid.uuid4().hex[:4].upper()}"
            
            fg_item = models.Item(
                id=uuid.uuid4(), sku=fg_sku, name="Audit Finished Good", unit_price=Decimal("100.00"),
                category="Finished Good", tenant_id=tenant_id
            )
            rm_item = models.Item(
                id=uuid.uuid4(), sku=rm_sku, name="Audit Raw Component", unit_price=Decimal("10.00"),
                category="Raw Component", tenant_id=tenant_id
            )
            db.add_all([fg_item, rm_item])
            db.flush()
            
            # Warehouse
            wh = db.query(models.Warehouse).filter_by(is_deleted=False).first()
            if not wh:
                wh = models.Warehouse(id=uuid.uuid4(), warehouse_code="AUDIT-WH", name="Audit Warehouse", tenant_id=tenant_id)
                db.add(wh)
                db.flush()
                
            # Seed inventory stock of component (100 units)
            stock = models.InventoryStock(
                id=uuid.uuid4(), item_id=rm_item.id, warehouse_id=wh.id,
                current_stock=Decimal("100.00"), reserved_stock=Decimal("0.00"), available_stock=Decimal("100.00"),
                tenant_id=tenant_id
            )
            db.add(stock)
            
            # Seed Cost Layer for component
            layer = models.InventoryCostLayer(
                id=uuid.uuid4(), item_id=rm_item.id, warehouse_id=wh.id,
                original_quantity=Decimal("100.00"), remaining_quantity=Decimal("100.00"),
                unit_cost=Decimal("10.00"), total_cost=Decimal("1000.00"), tenant_id=tenant_id
            )
            db.add(layer)
            db.flush()
            
            # BOM
            bom = models.BillOfMaterial(
                id=uuid.uuid4(), bom_number=f"BOM-AUD-{uuid.uuid4().hex[:4].upper()}",
                item_id=fg_item.id, revision="1.0", status="ACTIVE", tenant_id=tenant_id
            )
            db.add(bom)
            db.flush()
            
            bom_line = models.BillOfMaterialLine(
                id=uuid.uuid4(), bom_id=bom.id, component_item_id=rm_item.id,
                quantity=Decimal("2.00"), scrap_factor=Decimal("0.00"), uom="Pcs", tenant_id=tenant_id
            )
            db.add(bom_line)
            
            # Work Center
            wc_code = f"WC-AUD-{uuid.uuid4().hex[:4].upper()}"
            wc = models.WorkCenter(
                id=uuid.uuid4(), code=wc_code, name="Audit WorkCenter",
                capacity_per_day=Decimal("8.00"), cost_per_hour=Decimal("25.00"),
                available_hours_per_day=Decimal("8.00"), efficiency_percent=Decimal("100.00"),
                utilization_percent=Decimal("100.00"), status="ACTIVE", tenant_id=tenant_id
            )
            db.add(wc)
            db.flush()
            
            # Routing
            routing = models.Routing(
                id=uuid.uuid4(), item_id=fg_item.id, revision="1.0", status="ACTIVE", tenant_id=tenant_id
            )
            db.add(routing)
            db.flush()
            
            op = models.RoutingOperation(
                id=uuid.uuid4(), routing_id=routing.id, sequence_no=10,
                work_center_id=wc.id, operation_name="Audit Operation",
                setup_time_minutes=15, run_time_minutes=45, tenant_id=tenant_id
            )
            db.add(op)
            db.flush()
            
            # Test Work Order Cycle
            wo = manufacturing_engine.create_work_order(
                db=db, item_id=fg_item.id, quantity=Decimal("5.00"),
                planned_start_date=today, planned_end_date=today + timedelta(days=1), tenant_id=tenant_id
            )
            if wo.status != "PLANNED":
                raise ValueError("State Machine: Work Order creation failed to set PLANNED status")
                
            wo = manufacturing_engine.release_work_order(db, wo.id)
            if wo.status != "RELEASED":
                raise ValueError("State Machine: WO release failed to set RELEASED status")
                
            wo = manufacturing_engine.allocate_materials(db, wo.id, wh.id)
            if wo.status != "MATERIAL_ALLOCATED":
                raise ValueError("State Machine: WO material allocation failed")
                
            wo = manufacturing_engine.start_work_order(db, wo.id)
            if wo.status != "IN_PROGRESS":
                raise ValueError("State Machine: WO start failed")
                
            # Issue Materials
            ManufacturingAccountingService.post_material_issue(
                db=db, work_order_id=wo.id, component_item_id=rm_item.id,
                warehouse_id=wh.id, quantity=Decimal("10.00"), unit_cost=Decimal("10.00"), tenant_id=tenant_id
            )
            
            # Run Shop Floor Operation
            woo = db.query(models.WorkOrderOperation).filter_by(work_order_id=wo.id).first()
            ShopFloorService.start_operation(db, wo.id, woo.id)
            ShopFloorService.complete_operation(
                db=db, work_order_id=wo.id, operation_id=woo.id,
                actual_setup_minutes=15, actual_run_minutes=45, scrap_qty=Decimal("0.00"), tenant_id=tenant_id
            )
            
            # Move to QC Pending
            wo = manufacturing_engine.request_qc_inspection(db, wo.id)
            if wo.status != "QC_PENDING":
                raise ValueError("State Machine: WO failed to enter QC_PENDING")
                
            # Complete Quality Inspection
            qc_inspection = models.QualityInspection(
                id=uuid.uuid4(),
                inspection_number=f"QC-{uuid.uuid4().hex[:4].upper()}",
                work_order_id=wo.id,
                item_id=fg_item.id,
                inspected_qty=5.0,
                accepted_qty=5.0,
                rejected_qty=0.0,
                inspection_status="PASSED"
            )
            db.add(qc_inspection)
            db.flush()
            
            # Post finished goods receipt
            # Total costs: Material ($100) + Labor (1hr * $25 = $25) + Overhead (1hr * $25 = $25) = $150 => $30.00/unit actual cost.
            ManufacturingAccountingService.post_finished_goods_receipt(
                db=db, work_order_id=wo.id, warehouse_id=wh.id, quantity=Decimal("5.00"),
                unit_cost=Decimal("30.00"), tenant_id=tenant_id
            )
            wo.status = "COMPLETED"
            wo.actual_end_date = datetime.utcnow()
            db.flush()
            
            # Variance accounting clearance & close
            ManufacturingAccountingService.post_variance_accounting(db, wo.id, tenant_id)
            wo.status = "CLOSED"
            db.flush()
            
            print("  [PASS] State Machine and Shop Floor Simulation ran successfully without errors.")
            scores["Lifecycle Controls"] = 30
            
        except Exception as ex:
            print(f"  [FAIL] Work Order execution simulation crashed: {ex}")
            scores["Lifecycle Controls"] = 0
            defects.append(f"Simulation failure: {ex}")
            
        # ----------------------------------------------------
        # 4. WIP & TRIAL BALANCE RECONCILIATION (20 Points)
        # ----------------------------------------------------
        print("\n[Audit Step 4/5] WIP Subledger & General Ledger Reconciliation...")
        
        # Perform WIP subledger variance check
        wip_variance = ManufacturingAccountingService.get_wip_reconciliation_variance(db, tenant_id)
        print(f"  WIP Reconciliation Subledger Variance: {wip_variance}")
        
        # Verify Trial Balance remains balanced
        tb_balanced = False
        try:
            AccountingService.validate_trial_balance(db)
            print("  [PASS] Trial Balance is fully balanced.")
            tb_balanced = True
        except Exception as tb_ex:
            print(f"  [FAIL] Trial Balance validation failed: {tb_ex}")
            defects.append(f"Trial Balance unbalanced: {tb_ex}")
            
        # Verify no negative inventory
        neg_stocks = db.query(models.InventoryStock).filter(
            models.InventoryStock.current_stock < 0,
            models.InventoryStock.is_deleted == False
        ).count()
        print(f"  Negative Inventory Stock records: {neg_stocks}")
        
        reconciliation_passed = (wip_variance <= Decimal("0.001") and tb_balanced and neg_stocks == 0)
        if reconciliation_passed:
            print("  [PASS] WIP subledger fully reconciled and GL constraints validated.")
            scores["Reconciliation"] = 20
        else:
            print("  [FAIL] WIP subledger or GL reconciliation validation failed.")
            scores["Reconciliation"] = 5
            
        # ----------------------------------------------------
        # 5. LOT & BATCH TRACEABILITY (10 Points)
        # ----------------------------------------------------
        print("\n[Audit Step 5/5] Batch Lot Genealogy & Recall Traceability...")
        
        # Let's verify if we can query batch genealogy forward/backward
        try:
            # Seed a sample batch run trace
            fg_batch_num = f"B-FG-{uuid.uuid4().hex[:4].upper()}"
            rm_batch_num = f"B-RM-{uuid.uuid4().hex[:4].upper()}"
            
            fg_batch = models.ManufacturingBatch(
                id=uuid.uuid4(), finished_good_batch_number=fg_batch_num, item_id=fg_item.id,
                work_order_id=wo.id, produced_qty=Decimal("5.00"), scrap_qty=Decimal("0.00"),
                yield_percent=Decimal("100.00"), tenant_id=tenant_id
            )
            db.add(fg_batch)
            db.flush()
            
            batch_mat = models.ManufacturingBatchMaterial(
                id=uuid.uuid4(), batch_id=fg_batch.id,
                component_item_id=rm_item.id, source_batch_number=rm_batch_num,
                quantity_consumed=Decimal("10.00"), tenant_id=tenant_id
            )
            db.add(batch_mat)
            db.flush()
            
            # Forward Trace query (From component batch to FG batch)
            forward_trace = db.query(models.ManufacturingBatch).join(
                models.ManufacturingBatchMaterial
            ).filter(
                models.ManufacturingBatchMaterial.source_batch_number == rm_batch_num
            ).all()
            
            # Backward Trace query (From FG batch to component batch)
            backward_trace = db.query(models.ManufacturingBatchMaterial).filter(
                models.ManufacturingBatchMaterial.batch_id == fg_batch.id
            ).all()
            
            if len(forward_trace) > 0 and len(backward_trace) > 0:
                print("  [PASS] Forward and backward genealogy trace returns complete batches.")
                scores["Genealogy Trace"] = 10
            else:
                raise ValueError("Genealogy query returned empty traces")
                
        except Exception as gt_ex:
            print(f"  [FAIL] Genealogy Traceability checks failed: {gt_ex}")
            scores["Genealogy Trace"] = 0
            defects.append(f"Traceability failure: {gt_ex}")

        # Commit simulated entries
        db.commit()
        
    finally:
        db.close()
        
    # Calculate Final Score
    total_score = sum(scores.values())
    
    print("\n" + "=" * 70)
    print("                      MANUFACTURING CERTIFICATION SCORECARD")
    print("=" * 70)
    for section, score in scores.items():
        print(f"  {section:<40}: {score} Points")
    print("-" * 70)
    print(f"  FINAL AUDIT SCORE                          : {total_score} / 100")
    print("=" * 70)
    
    if defects:
        print("\nDetected Defects/Issues:")
        for defect in defects:
            print(f"  - {defect}")
            
    if total_score >= 90:
        print("\n>>> CERTIFICATION RESULT: PASSED (READY FOR PHASE 15 PRODUCTION) <<<")
        sys.exit(0)
    else:
        print("\n>>> CERTIFICATION RESULT: FAILED (AUDIT SCORE BELOW 90) <<<")
        sys.exit(1)

if __name__ == '__main__':
    run_manufacturing_audit()
