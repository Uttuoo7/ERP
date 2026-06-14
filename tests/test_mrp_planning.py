import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, ItemFactory, WarehouseFactory
)
from tests.fixtures.auth import auth_headers
from backend import models

pytestmark = pytest.mark.mrp_planning

def setup_mrp_test_data(db_session):
    """Seed base data for MRP tests: user, item, warehouse."""
    user = db_session.query(models.User).filter_by(username="mrp_test_admin").first()
    if not user:
        user = UserFactory.create(db_session, role=models.Role.ADMIN, username="mrp_test_admin")
    
    item = ItemFactory.create(db_session, sku="MRP-TEST-ITEM-1", name="MRP Test Raw Material", standard_rate=Decimal("150.00"))
    warehouse = WarehouseFactory.create(db_session, warehouse_code="MRP-WH-1", name="MRP Test Warehouse")
    
    db_session.commit()
    return user, item, warehouse

def seed_stock_and_policy(db_session, user, item, warehouse):
    """Seed inventory stock and safety stock policy for recommendation generation."""
    # 1. Seed stock (20 units)
    stock = db_session.query(models.InventoryStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if not stock:
        stock = models.InventoryStock(
            item_id=item.id,
            warehouse_id=warehouse.id,
            current_stock=20.0,
            reserved_stock=0.0,
            available_stock=20.0,
            tenant_id=user.tenant_id
        )
        db_session.add(stock)
    else:
        stock.current_stock = 20.0
        stock.available_stock = 20.0
    
    # 2. Seed safety stock policy: Safety stock = 50, Reorder level = 60, Reorder qty = 100
    policy = db_session.query(models.SafetyStockPolicy).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if not policy:
        policy = models.SafetyStockPolicy(
            item_id=item.id,
            warehouse_id=warehouse.id,
            safety_stock_qty=50.0,
            reorder_point_qty=60.0,
            reorder_qty=100.0,
            lead_time_days=4,
            tenant_id=user.tenant_id
        )
        db_session.add(policy)
    else:
        policy.safety_stock_qty = 50.0
        policy.reorder_point_qty = 60.0
        policy.reorder_qty = 100.0
        
    db_session.commit()

@pytest.mark.api
def test_create_demand_forecast(client, db_session):
    user, item, warehouse = setup_mrp_test_data(db_session)
    headers = auth_headers(user_id=str(user.id), role="ADMIN")
    
    payload = {
        "item_id": str(item.id),
        "warehouse_id": str(warehouse.id),
        "forecast_date": (datetime.utcnow() + timedelta(days=15)).isoformat(),
        "forecast_qty": 100.5,
        "forecast_method": "MANUAL",
        "forecast_version": "V1",
        "is_active": True
    }
    
    response = client.post("/api/mfg/mrp/forecasts", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["item_id"] == str(item.id)
    assert float(data["forecast_qty"]) == 100.5
    assert data["forecast_method"] == "MANUAL"
    
    # Verify in DB
    db_forecast = db_session.query(models.DemandForecast).filter_by(id=data["id"]).first()
    assert db_forecast is not None
    assert db_forecast.forecast_qty == Decimal("100.5000")

@pytest.mark.api
def test_create_safety_stock_policy(client, db_session):
    user, item, warehouse = setup_mrp_test_data(db_session)
    headers = auth_headers(user_id=str(user.id), role="ADMIN")
    
    payload = {
        "item_id": str(item.id),
        "warehouse_id": str(warehouse.id),
        "safety_stock_qty": 50.0,
        "reorder_point_qty": 75.0,
        "reorder_qty": 150.0,
        "lead_time_days": 5
    }
    
    response = client.post("/api/mfg/mrp/safety-stock", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["item_id"] == str(item.id)
    assert float(data["safety_stock_qty"]) == 50.0
    assert float(data["reorder_point_qty"]) == 75.0
    
    # Verify in DB
    policy = db_session.query(models.SafetyStockPolicy).filter_by(id=data["id"]).first()
    assert policy is not None
    assert policy.safety_stock_qty == Decimal("50.0000")

@pytest.mark.api
def test_generate_moving_average_forecast(client, db_session):
    user, item, warehouse = setup_mrp_test_data(db_session)
    headers = auth_headers(user_id=str(user.id), role="ADMIN")
    
    # Seed historical inventory issues
    issue = models.InventoryIssue(
        issue_number="ISSUE-MRP-HIST-1",
        warehouse_id=warehouse.id,
        issue_date=datetime.utcnow() - timedelta(days=15),
        status="APPROVED",
        issue_type="PRODUCTION",
        tenant_id=user.tenant_id
    )
    db_session.add(issue)
    db_session.flush()
    
    issue_line = models.InventoryIssueLine(
        issue_id=issue.id,
        item_id=item.id,
        quantity=300.0,
        unit_cost=Decimal("150.00"),
        total_cost=Decimal("45000.00"),
        costing_method_used="FIFO",
        issue_cost_basis="FIFO",
        tenant_id=user.tenant_id
    )
    db_session.add(issue_line)
    db_session.commit()
    
    payload = {
        "item_id": str(item.id),
        "warehouse_id": str(warehouse.id),
        "forecast_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "months_lookback": 3,
        "method": "MOVING_AVERAGE"
    }
    
    response = client.post("/api/mfg/mrp/forecasts/generate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["item_id"] == str(item.id)
    # 300 total qty / 3 months lookback = 100.0 forecast qty
    assert float(data["forecast_qty"]) == 100.0
    assert data["forecast_version"] == "AUTO_MA"

@pytest.mark.api
def test_mrp_engine_run(client, db_session):
    user, item, warehouse = setup_mrp_test_data(db_session)
    headers = auth_headers(user_id=str(user.id), role="ADMIN")
    seed_stock_and_policy(db_session, user, item, warehouse)
    
    # Run MRP
    response = client.post("/api/mfg/mrp/run", json={}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    
    # The active recommendation should be for our test item
    rec = [r for r in data if r["item_id"] == str(item.id)][0]
    assert float(rec["available_qty"]) == 20.0
    # shortage = max(safety_stock, ROP) - available = 60 - 20 = 40
    assert float(rec["shortage_qty"]) == 40.0
    # rec_qty = max(shortage, reorder_qty) = max(40, 100) = 100
    assert float(rec["recommended_procurement_qty"]) == 100.0
    assert rec["status"] == "PENDING"
    
    # Verify Plan exists in database
    plan_id = rec["source_plan_id"]
    plan = db_session.query(models.MRPPlan).filter_by(id=plan_id).first()
    assert plan is not None
    assert plan.status == "COMPLETED"
    assert plan.recommendations_generated >= 1

@pytest.mark.api
def test_mrp_recommendation_approval_rejection_and_confirm_plan(client, db_session):
    user, item, warehouse = setup_mrp_test_data(db_session)
    headers = auth_headers(user_id=str(user.id), role="ADMIN")
    seed_stock_and_policy(db_session, user, item, warehouse)
    
    # Run MRP to populate recommendations
    response = client.post("/api/mfg/mrp/run", json={}, headers=headers)
    assert response.status_code == 200
    recs = response.json()
    assert len(recs) > 0
    
    rec_id = recs[0]["id"]
    plan_id = recs[0]["source_plan_id"]
    
    # 1. Approve recommendation
    app_response = client.post(f"/api/mfg/mrp/recommendations/{rec_id}/approve", headers=headers)
    assert app_response.status_code == 200
    app_data = app_response.json()
    assert app_data["status"] == "CONVERTED"
    assert app_data["purchase_requisition_id"] is not None
    
    # Verify in DB
    db_rec = db_session.query(models.MRPRecommendation).filter_by(id=rec_id).first()
    assert db_rec.status == "CONVERTED"
    assert db_rec.purchase_requisition_id is not None
    
    # 2. Reject recommendation (run MRP again to get a new pending recommendation)
    run_response = client.post("/api/mfg/mrp/run", json={}, headers=headers)
    new_recs = run_response.json()
    new_rec_id = new_recs[0]["id"]
    new_plan_id = new_recs[0]["source_plan_id"]
    
    rej_response = client.post(f"/api/mfg/mrp/recommendations/{new_rec_id}/reject", headers=headers)
    assert rej_response.status_code == 200
    rej_data = rej_response.json()
    assert rej_data["status"] == "REJECTED"
    
    # 3. Confirm entire plan
    # Run MRP again to get new pending recommendations
    run_response3 = client.post("/api/mfg/mrp/run", json={}, headers=headers)
    recs3 = run_response3.json()
    plan_id3 = recs3[0]["source_plan_id"]
    
    conf_response = client.post(f"/api/mfg/mrp/plans/{plan_id3}/confirm", headers=headers)
    assert conf_response.status_code == 200
    conf_data = conf_response.json()
    assert conf_data["status"] == "COMPLETED"
    
    # Check that recommendations in this plan are now converted
    db_recs = db_session.query(models.MRPRecommendation).filter_by(source_plan_id=plan_id3).all()
    for r in db_recs:
        assert r.status == "CONVERTED"
