import pytest
import uuid
from backend import models
from tests.factories.entity_factories import POFactory, VendorFactory, ItemFactory, UserFactory, WarehouseFactory

pytestmark = pytest.mark.api

def test_global_search_unauthenticated(client):
    """GET /api/search without token should return 401 or 403."""
    response = client.get("/api/search?q=test")
    assert response.status_code in (401, 403)

def test_global_search_empty_query(client, admin_headers):
    """GET /api/search with empty query should return empty groups."""
    response = client.get("/api/search?q=", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "purchase_orders" in data
    assert "items" in data
    assert len(data["purchase_orders"]) == 0

def test_global_search_ranking_and_grouping(client, db_session, admin_headers):
    """Test that search matches are grouped by entity type and exact document matches are ranked first."""
    # Create test items
    user = UserFactory.create(db_session)
    warehouse = WarehouseFactory.create(db_session)
    vendor = VendorFactory.create(db_session, name="Acme Corp")
    item = ItemFactory.create(db_session, sku="SKU-T1", name="Test Item 1")
    
    # Create POs: PO-T1001, PO-T10010, PO-T10011
    po_exact = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-T1001", total_amount=100)
    po_prefix1 = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-T10010", total_amount=200)
    po_prefix2 = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-T10011", total_amount=300)
    
    db_session.flush()
    
    # Search for "PO-T1001"
    response = client.get("/api/search?q=PO-T1001", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Assert grouped response structure
    for key in ["customers", "vendors", "items", "purchase_orders", "sales_orders", "work_orders", "grns", "invoices"]:
        assert key in data
        
    pos = data["purchase_orders"]
    assert len(pos) >= 3
    
    # Assert exact match (PO-T1001) is ranked first
    assert pos[0]["title"] == "PO-T1001"
    assert pos[0]["match_type"] == "exact_code"
    assert pos[0]["priority"] == 1
    
    # Assert subsequent items are prefix matches
    assert pos[1]["title"] in ("PO-T10010", "PO-T10011")
    assert pos[1]["match_type"] == "prefix"
    assert pos[1]["priority"] == 3

def test_global_search_uuid_exact_match(client, db_session, admin_headers):
    """Test that searching by a valid UUID returns an exact ID match in the correct ranking priority."""
    vendor = VendorFactory.create(db_session, name="Unique Vendor")
    db_session.flush()
    
    vendor_id_str = str(vendor.id)
    
    response = client.get(f"/api/search?q={vendor_id_str}", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    
    vendors = data["vendors"]
    assert len(vendors) == 1
    assert vendors[0]["id"] == vendor_id_str
    assert vendors[0]["match_type"] == "exact_id"
    assert vendors[0]["priority"] == 2
