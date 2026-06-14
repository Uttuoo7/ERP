import os
import sys
import subprocess
import uuid
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import text

from backend import models
from mrp_audit import MRPAuditRunner, get_forecast_accuracy_metrics


def test_audit_db_integrity_clean(db_session):
    """Verify clean database produces no integrity defects."""
    runner = MRPAuditRunner(db_session)
    res = runner.audit_database_integrity()
    assert res["passed"] is True
    assert res["orphans"] == 0
    assert res["duplicates"] == 0


def test_audit_db_integrity_with_defects(test_session_factory):
    """Verify that orphan references and duplicates are detected."""
    db = test_session_factory()
    db.execute(text("PRAGMA foreign_keys = OFF"))
    
    orphan_rec = models.MRPRecommendation(
        item_id=uuid.uuid4(),  # Random / non-existent
        warehouse_id=None,
        required_qty=Decimal("10.00"),
        available_qty=Decimal("0.00"),
        shortage_qty=Decimal("10.00"),
        recommended_procurement_qty=10.0,
        recommended_order_qty=Decimal("10.00"),
        recommendation_type='PURCHASE',
        status='PENDING'
    )
    db.add(orphan_rec)
    db.commit()

    try:
        runner = MRPAuditRunner(db)
        res = runner.audit_database_integrity()
        assert res["passed"] is False
        assert res["orphans"] > 0
    finally:
        # Clean up orphan record
        db.execute(text("PRAGMA foreign_keys = OFF"))
        db.delete(orphan_rec)
        db.commit()
        db.execute(text("PRAGMA foreign_keys = ON"))
        db.close()


def test_audit_recommendation_governance_invalid(db_session):
    """Verify negative quantities and priority mismatches are detected."""
    # Seed an item and policy
    item = models.Item(
        sku="GOV-ITEM-1",
        name="Gov Test Item",
        unit_price=Decimal("10.00"),
        standard_rate=Decimal("10.00"),
        is_active=True,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    wh = models.Warehouse(
        warehouse_code="GOV-WH-1",
        name="Gov Warehouse",
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add_all([item, wh])
    db_session.flush()

    policy = models.SafetyStockPolicy(
        item_id=item.id,
        warehouse_id=wh.id,
        safety_stock_qty=50.0,
        reorder_point_qty=60.0,
        reorder_qty=100.0,
        lead_time_days=4,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(policy)
    db_session.flush()

    # Create recommendation with negative qty and priority mismatch (available is 100, which is >= reorder_point, but priority is set to CRITICAL)
    rec = models.MRPRecommendation(
        item_id=item.id,
        warehouse_id=wh.id,
        required_qty=Decimal("100.00"),
        available_qty=Decimal("100.00"),  # > reorder point (60)
        shortage_qty=Decimal("0.00"),
        recommended_procurement_qty=-5.0,  # Negative
        recommended_order_qty=Decimal("-5.00"),  # Negative
        recommendation_type='PURCHASE',
        priority='CRITICAL',  # Expect LOW
        status='PENDING'
    )
    db_session.add(rec)
    db_session.flush()

    runner = MRPAuditRunner(db_session)
    res = runner.audit_recommendation_governance()
    assert res["passed"] is False
    assert res["negatives"] > 0
    assert res["priority_violations"] > 0


def test_audit_transfer_logic_insufficient_stock(db_session):
    """Verify transfer checks detect when source warehouse does not have enough safety surplus."""
    item = models.Item(
        sku="TRF-ITEM-1",
        name="Trf Test Item",
        unit_price=Decimal("10.00"),
        standard_rate=Decimal("10.00"),
        is_active=True,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    wh_src = models.Warehouse(warehouse_code="TRF-SRC", name="Source Warehouse", tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID)
    wh_dest = models.Warehouse(warehouse_code="TRF-DEST", name="Dest Warehouse", tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID)
    db_session.add_all([item, wh_src, wh_dest])
    db_session.flush()

    # Seed low stock at source
    src_stock = models.InventoryStock(
        warehouse_id=wh_src.id,
        item_id=item.id,
        current_stock=Decimal("10.0"),  # Very low
        reserved_stock=Decimal("0.0"),
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(src_stock)

    policy_src = models.SafetyStockPolicy(
        item_id=item.id,
        warehouse_id=wh_src.id,
        safety_stock_qty=50.0,  # Safety stock requires 50, so 10 is already a breach!
        reorder_point_qty=60.0,
        reorder_qty=100.0,
        lead_time_days=4,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(policy_src)
    db_session.flush()

    # Create transfer recommendation of 40 units
    rec = models.MRPRecommendation(
        item_id=item.id,
        warehouse_id=wh_dest.id,
        required_qty=Decimal("100.00"),
        available_qty=Decimal("0.00"),
        shortage_qty=Decimal("40.00"),
        recommended_procurement_qty=40.0,
        recommended_order_qty=Decimal("40.00"),
        recommendation_type='TRANSFER',
        status='PENDING',
        narrative=f"Shortage met by transferring 40.00 units from Source Warehouse."
    )
    db_session.add(rec)
    db_session.flush()

    runner = MRPAuditRunner(db_session)
    res = runner.audit_transfer_logic()
    assert res["passed"] is False
    assert res["violations"] > 0


def test_audit_expedite_logic_violations(db_session):
    """Verify expedite check flags POs that don't cover shortage or aren't delayed."""
    item = models.Item(
        sku="EXP-ITEM-1",
        name="Exp Test Item",
        unit_price=Decimal("10.00"),
        standard_rate=Decimal("10.00"),
        is_active=True,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    wh = models.Warehouse(warehouse_code="EXP-WH-1", name="Exp WH", tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID)
    vendor = models.Vendor(name="Exp Vendor", contact_email="expedite@test.com", tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID)
    db_session.add_all([item, wh, vendor])
    db_session.flush()

    # Create PO with receipt date in past or equal to required date (not delayed/expected after required)
    po = models.PurchaseOrder(
        po_number="PO-EXP-001",
        vendor_id=vendor.id,
        warehouse_id=wh.id,
        status="ISSUED",
        expected_delivery_date=datetime.utcnow() - timedelta(days=2),  # Past date
        ship_to_contact_name="Test Contact",
        ship_to_address_line1="123 Test St",
        ship_to_address_line2="Apt 4B",
        ship_to_city="Mumbai",
        ship_to_state="Maharashtra",
        ship_to_pin_code="400001",
        ship_to_phone="1234567890",
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(po)
    db_session.flush()

    pol = models.POLineItem(
        po_id=po.id,
        item_id=item.id,
        quantity_ordered=100,
        quantity_received=95,  # Only 5 remaining
        unit_price=Decimal("10.00"),
        delivery_date=datetime.utcnow() - timedelta(days=2),
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(pol)
    db_session.flush()

    # Expedite recommendation expecting 50 units (but PO has only 5 remaining)
    rec = models.MRPRecommendation(
        item_id=item.id,
        warehouse_id=wh.id,
        required_qty=Decimal("100.00"),
        available_qty=Decimal("0.00"),
        shortage_qty=Decimal("50.00"),  # Exceeds PO line remaining qty of 5
        recommended_procurement_qty=50.0,
        recommended_order_qty=Decimal("50.00"),
        recommendation_type='EXPEDITE',
        required_date=datetime.utcnow() + timedelta(days=5),
        source_po_id=po.id,
        status='PENDING'
    )
    db_session.add(rec)
    db_session.flush()

    runner = MRPAuditRunner(db_session)
    res = runner.audit_expedite_logic()
    assert res["passed"] is False
    assert res["violations"] > 0


def test_forecast_accuracy_metrics(db_session):
    """Verify MAD, MAPE, Variance, and Bias calculations match statistical expectations."""
    # Seed matching Forecast and Posted InventoryIssue
    item = models.Item(
        sku="FC-ITEM",
        name="Fc Item",
        unit_price=Decimal("10.00"),
        standard_rate=Decimal("10.00"),
        is_active=True,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    wh = models.Warehouse(warehouse_code="FC-WH", name="Fc WH", tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID)
    db_session.add_all([item, wh])
    db_session.flush()

    today = datetime.utcnow()
    # Forecast: 150
    forecast = models.DemandForecast(
        item_id=item.id,
        warehouse_id=wh.id,
        forecast_date=today,
        forecast_qty=Decimal("150.00"),
        forecast_method="MANUAL",
        is_active=True,
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(forecast)

    # Actual Issue: 120 (Error: 30)
    issue = models.InventoryIssue(
        issue_number="ISS-FC-01",
        warehouse_id=wh.id,
        issue_date=today,
        status="POSTED",
        tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
    )
    db_session.add(issue)
    db_session.flush()

    line = models.InventoryIssueLine(
        issue_id=issue.id,
        item_id=item.id,
        quantity=Decimal("120.00"),
        costing_method_used="STANDARD",
        issue_cost_basis="STANDARD"
    )
    db_session.add(line)
    db_session.flush()

    metrics = get_forecast_accuracy_metrics(db_session)
    assert metrics["mad"] == 30.0
    # MAPE = (30 / 120) * 100 = 25%
    assert metrics["mape"] == 25.0
    assert metrics["bias"] == 30.0
    assert metrics["status"] == "ACCEPTABLE"


def test_benchmark_performance():
    """Verify performance benchmark executes and returns all measured attributes."""
    runner = MRPAuditRunner()
    res = runner.run_benchmark()
    assert res["passed"] is True
    assert "forecast_time" in res
    assert "mrp_time" in res
    assert "conversion_time" in res
    assert res["rec_count"] > 0
    assert res["forecast_count"] >= 25000


def test_cli_execution():
    """Verify the audit script runs via command-line and prints headers correctly."""
    result = subprocess.run(
        [sys.executable, "mrp_audit.py"],
        capture_output=True,
        text=True
    )
    # The return code can be 0 or 1 depending on dev DB contents, but it should output header and summaries
    assert "PHASE 13 MANUFACTURING MRP & PLANNING AUDIT REPORT" in result.stdout
    assert "Audit Results Summary" in result.stdout
