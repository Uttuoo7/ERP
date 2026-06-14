import pytest
import uuid
from decimal import Decimal
from datetime import datetime
from tests.factories.entity_factories import UserFactory, ItemFactory, WarehouseFactory
from backend import models, inventory_engine

pytestmark = pytest.mark.inventory

@pytest.fixture
def test_user(db_session):
    return UserFactory.create(db_session, role=models.Role.ADMIN)

@pytest.fixture
def test_item(db_session):
    return ItemFactory.create(db_session, unit_price=Decimal("10.00"), category="Raw Component")

@pytest.fixture
def test_warehouse(db_session):
    return WarehouseFactory.create(db_session)

@pytest.fixture
def set_settings(db_session):
    def _set(costing_method: str, allow_negative: bool):
        config = db_session.query(models.TenantConfig).first()
        if not config:
            config = models.TenantConfig(
                tenant_uuid=models.SYSTEM_DEFAULT_TENANT_UUID,
                inventory_costing_method=costing_method,
                allow_negative_inventory=allow_negative
            )
            db_session.add(config)
        else:
            config.inventory_costing_method = costing_method
            config.allow_negative_inventory = allow_negative
        db_session.commit()
    return _set


class TestFIFODepletion:
    def test_fifo_layer_creation_on_receipt(self, db_session, test_user, test_item, test_warehouse, set_settings):
        """Verify that record_receipt creates a cost layer, valuation entry, and audit log."""
        set_settings("FIFO", False)
        qty = 50
        cost = Decimal("12.50")
        
        # Act
        inventory_engine.record_receipt(
            db=db_session,
            item_id=test_item.id,
            warehouse_id=test_warehouse.id,
            qty=qty,
            unit_cost=cost,
            reference_type="MANUAL",
            user_id=test_user.id
        )
        
        # Assert Layer
        layers = db_session.query(models.InventoryCostLayer).filter_by(item_id=test_item.id).all()
        assert len(layers) == 1
        layer = layers[0]
        assert layer.original_quantity == Decimal("50.0000")
        assert layer.remaining_quantity == Decimal("50.0000")
        assert layer.unit_cost == Decimal("12.5000")
        assert layer.layer_status == "OPEN"
        
        # Assert Valuation Entry
        vals = db_session.query(models.InventoryValuationEntry).filter_by(item_id=test_item.id).all()
        assert len(vals) == 1
        val_entry = vals[0]
        assert val_entry.transaction_type == "RECEIPT"
        assert val_entry.quantity == Decimal("50.0000")
        assert val_entry.unit_cost == Decimal("12.5000")
        assert val_entry.running_inventory_qty == Decimal("50.0000")
        assert val_entry.running_inventory_value == Decimal("625.0000")
        
        # Assert Audit Log
        logs = db_session.query(models.InventoryAuditLog).filter_by(item_id=test_item.id).all()
        assert len(logs) == 1
        log = logs[0]
        assert log.action_type == "RECEIPT"
        assert log.before_quantity == Decimal("0.0000")
        assert log.after_quantity == Decimal("50.0000")
        assert log.before_value == Decimal("0.0000")
        assert log.after_value == Decimal("625.0000")

    def test_fifo_depletion_multiple_layers(self, db_session, test_user, test_item, test_warehouse, set_settings):
        """Verify that cost layers are consumed chronologically in FIFO."""
        set_settings("FIFO", False)
        
        # Layer 1: Receipt 10 @ 5.00
        inventory_engine.record_receipt(
            db=db_session, item_id=test_item.id, warehouse_id=test_warehouse.id,
            qty=10, unit_cost=Decimal("5.00"), reference_type="MANUAL", user_id=test_user.id
        )
        # Layer 2: Receipt 20 @ 6.00
        inventory_engine.record_receipt(
            db=db_session, item_id=test_item.id, warehouse_id=test_warehouse.id,
            qty=20, unit_cost=Decimal("6.00"), reference_type="MANUAL", user_id=test_user.id
        )
        
        # Issue 15 units.
        # FIFO depletion should consume:
        # - 10 units from Layer 1 @ 5.00 (value = 50.00)
        # - 5 units from Layer 2 @ 6.00 (value = 30.00)
        # Total value issued: 80.00. Avg cost = 80.00 / 15 = 5.3333
        issue_cost = inventory_engine.consume_cost_layers(
            db=db_session,
            item_id=test_item.id,
            warehouse_id=test_warehouse.id,
            qty_to_issue=Decimal("15.00"),
            fallback_cost=Decimal("6.00"),
            reference_type="MANUAL",
            reference_id=None,
            user_id=test_user.id
        )
        
        # Assert avg cost matches
        assert round(issue_cost, 4) == round(Decimal("80.00") / Decimal("15.00"), 4)
        
        # Assert layers states
        layers = db_session.query(models.InventoryCostLayer).filter_by(item_id=test_item.id).order_by(models.InventoryCostLayer.created_at.asc()).all()
        assert len(layers) == 2
        
        # Layer 1 consumed
        assert layers[0].remaining_quantity == 0
        assert layers[0].layer_status == "CONSUMED"
        assert layers[0].consumed_at is not None
        
        # Layer 2 partially consumed
        assert layers[1].remaining_quantity == Decimal("15.00")
        assert layers[1].layer_status == "PARTIALLY_CONSUMED"


class TestNegativeInventoryControls:
    def test_negative_inventory_rejected_by_default(self, db_session, test_user, test_item, test_warehouse, set_settings):
        """When allow_negative_inventory is False, issues exceeding stock must raise ValueError."""
        set_settings("FIFO", False)
        
        # Receive 10 units
        inventory_engine.record_receipt(
            db=db_session, item_id=test_item.id, warehouse_id=test_warehouse.id,
            qty=10, unit_cost=Decimal("5.00"), reference_type="MANUAL", user_id=test_user.id
        )
        
        # Try to issue 15 units -> should raise ValueError
        with pytest.raises(ValueError, match="Insufficient inventory available."):
            inventory_engine.record_issue(
                db=db_session,
                item_id=test_item.id,
                warehouse_id=test_warehouse.id,
                qty=15,
                reference_type="MANUAL",
                user_id=test_user.id
            )

    def test_negative_inventory_permitted_when_enabled(self, db_session, test_user, test_item, test_warehouse, set_settings):
        """When allow_negative_inventory is True, issue exceeding stock creates negative layer and succeeds."""
        set_settings("FIFO", True)
        
        # Receive 10 units @ 5.00
        inventory_engine.record_receipt(
            db=db_session, item_id=test_item.id, warehouse_id=test_warehouse.id,
            qty=10, unit_cost=Decimal("5.00"), reference_type="MANUAL", user_id=test_user.id
        )
        
        # Issue 15 units.
        # Should consume 10 units @ 5.00 and create a negative layer for 5 units @ 5.00
        inventory_engine.record_issue(
            db=db_session,
            item_id=test_item.id,
            warehouse_id=test_warehouse.id,
            qty=15,
            reference_type="MANUAL",
            user_id=test_user.id
        )
        
        # Assert WarehouseStock is -5
        wh_stock = db_session.query(models.WarehouseStock).filter_by(
            item_id=test_item.id, warehouse_id=test_warehouse.id
        ).first()
        assert wh_stock.quantity_on_hand == -5
        
        # Check negative cost layer exists
        neg_layer = db_session.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.item_id == test_item.id,
            models.InventoryCostLayer.remaining_quantity < 0
        ).first()
        assert neg_layer is not None
        assert neg_layer.remaining_quantity == -5
        
        # Check audit log records issue
        logs = db_session.query(models.InventoryAuditLog).filter_by(
            item_id=test_item.id, action_type="ISSUE"
        ).all()
        assert len(logs) == 1
        assert logs[0].after_quantity == -5


class TestValuationSettingsAPIs:
    def test_get_and_post_settings_api(self, client, admin_headers, db_session):
        """Verify settings GET and POST API endpoints."""
        # GET
        res = client.get("/api/inventory/settings", headers=admin_headers)
        assert res.status_code == 200
        assert "inventory_costing_method" in res.json()
        assert "allow_negative_inventory" in res.json()
        
        # POST
        payload = {
            "inventory_costing_method": "WAC",
            "allow_negative_inventory": True
        }
        res = client.post("/api/inventory/settings", json=payload, headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["inventory_costing_method"] == "WAC"
        assert data["allow_negative_inventory"] is True

    def test_get_valuation_report_api(self, client, admin_headers, db_session, test_user, test_item, test_warehouse, set_settings):
        """Verify valuation report endpoint returns correct calculations and structure."""
        set_settings("FIFO", False)
        # Seed stock layer
        inventory_engine.record_receipt(
            db=db_session,
            item_id=test_item.id,
            warehouse_id=test_warehouse.id,
            qty=100,
            unit_cost=Decimal("15.00"),
            reference_type="MANUAL",
            user_id=test_user.id
        )
        db_session.commit()
        
        # Call API
        res = client.get("/api/inventory/valuation", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "items" in data
        assert "warehouse_totals" in data
        assert "category_totals" in data
        assert "company_total_value" in data
        
        assert data["company_total_value"] == 1500.0
        assert data["warehouse_totals"][test_warehouse.name] == 1500.0
        assert data["category_totals"][test_item.category] == 1500.0
        
        item_data = data["items"][0]
        assert item_data["sku"] == test_item.sku
        assert item_data["quantity_on_hand"] == 100.0
        assert item_data["unit_cost"] == 15.0
        assert item_data["inventory_value"] == 1500.0
