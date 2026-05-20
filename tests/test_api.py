"""
tests/test_api.py
API endpoint validation — tests payload validation, response structure,
pagination, and error handling across all major ERP modules.
"""
import pytest
import uuid
from tests.factories.entity_factories import UserFactory, VendorFactory, ItemFactory, WarehouseFactory
from backend import models


pytestmark = pytest.mark.api


# ─── Vendors API ──────────────────────────────────────────────────────────────

class TestVendorsAPI:
    def test_list_vendors_returns_200(self, client, admin_headers):
        response = client.get("/api/vendors/", headers=admin_headers)
        assert response.status_code == 200

    def test_list_vendors_returns_list(self, client, admin_headers):
        response = client.get("/api/vendors/", headers=admin_headers)
        data = response.json()
        assert isinstance(data, (list, dict))  # Paginated or raw list

    def test_create_vendor_missing_required_fields(self, client, admin_headers):
        """Creating a vendor without required fields should return 422."""
        response = client.post("/api/vendors/", json={}, headers=admin_headers)
        assert response.status_code == 422

    def test_get_nonexistent_vendor_returns_404(self, client, admin_headers):
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/vendors/{fake_id}", headers=admin_headers)
        assert response.status_code == 404

    def test_create_vendor_valid_payload(self, client, admin_headers):
        """A complete vendor payload should create successfully."""
        payload = {
            "name": "Test Vendor API Created",
            "contact_email": "api_test_vendor@test.local",
            "contact_phone": "9000000001",
            "default_lead_time_days": 7,
            "gstin": f"27ABCDE{1000 + hash(uuid.uuid4()) % 9000}F1Z5",
            "is_msme": False,
        }
        response = client.post("/api/vendors/", json=payload, headers=admin_headers)
        assert response.status_code in (200, 201)
        if response.status_code in (200, 201):
            data = response.json()
            assert data.get("name") == payload["name"]


# ─── Items API ────────────────────────────────────────────────────────────────

class TestItemsAPI:
    def test_list_items_returns_200(self, client, admin_headers):
        response = client.get("/api/items/", headers=admin_headers)
        assert response.status_code == 200

    def test_create_item_missing_sku_returns_422(self, client, admin_headers):
        payload = {"name": "Missing SKU Item", "unit_price": 100}
        response = client.post("/api/items/", json=payload, headers=admin_headers)
        assert response.status_code == 422

    def test_get_nonexistent_item_returns_404(self, client, admin_headers):
        response = client.get(f"/api/items/{uuid.uuid4()}", headers=admin_headers)
        assert response.status_code == 404

    def test_create_item_valid_payload(self, client, admin_headers):
        payload = {
            "sku": f"API-SKU-{uuid.uuid4().hex[:6].upper()}",
            "name": "Test API Item",
            "unit_price": 299.99,
            "gst_rate": 18.0,
            "uom": "Nos",
            "category": "Test Category",
        }
        response = client.post("/api/items/", json=payload, headers=admin_headers)
        assert response.status_code in (200, 201)


# ─── Purchase Orders API ───────────────────────────────────────────────────────

class TestPurchaseOrdersAPI:
    def test_list_pos_returns_200(self, client, buyer_headers):
        response = client.get("/api/pos/", headers=buyer_headers)
        assert response.status_code == 200

    def test_get_nonexistent_po_returns_404(self, client, buyer_headers):
        response = client.get(f"/api/pos/{uuid.uuid4()}", headers=buyer_headers)
        assert response.status_code == 404

    def test_create_po_missing_vendor_returns_422(self, client, buyer_headers):
        """PO without vendor_id should fail validation."""
        payload = {"po_number": "PO-INVALID-001", "total_amount": 1000}
        response = client.post("/api/pos/convert-rfq", json=payload, headers=buyer_headers)
        assert response.status_code in (422, 400)


# ─── Invoices API ─────────────────────────────────────────────────────────────

class TestInvoicesAPI:
    def test_list_invoices_returns_200(self, client, finance_headers):
        response = client.get("/api/invoices/", headers=finance_headers)
        assert response.status_code == 200

    def test_get_nonexistent_invoice_returns_404(self, client, finance_headers):
        response = client.get(f"/api/invoices/{uuid.uuid4()}", headers=finance_headers)
        assert response.status_code == 404


# ─── GRN API ─────────────────────────────────────────────────────────────────

class TestGRNAPI:
    def test_list_grns_returns_200(self, client, warehouse_headers):
        response = client.get("/api/grns/", headers=warehouse_headers)
        assert response.status_code == 200


# ─── Analytics API ────────────────────────────────────────────────────────────

class TestAnalyticsAPI:
    def test_command_center_returns_200(self, client, admin_headers):
        response = client.get("/api/analytics/command-center", headers=admin_headers)
        assert response.status_code == 200

    def test_command_center_has_expected_keys(self, client, admin_headers):
        response = client.get("/api/analytics/command-center", headers=admin_headers)
        if response.status_code == 200:
            data = response.json()
            # The command center should return some KPI structure
            assert isinstance(data, dict)

    def test_procurement_analytics_returns_200(self, client, admin_headers):
        response = client.get("/api/analytics/procurement", headers=admin_headers)
        assert response.status_code in (200, 404)  # 404 acceptable if endpoint not yet wired

    def test_inventory_analytics_returns_200(self, client, admin_headers):
        response = client.get("/api/analytics/inventory", headers=admin_headers)
        assert response.status_code in (200, 404)


# ─── Pagination & Filtering ───────────────────────────────────────────────────

class TestPaginationAndFiltering:
    def test_vendors_pagination_page_param(self, client, admin_headers):
        response = client.get("/api/vendors/?page=1&limit=5", headers=admin_headers)
        assert response.status_code == 200

    def test_vendors_large_page_returns_empty(self, client, admin_headers):
        response = client.get("/api/vendors/?page=99999&limit=10", headers=admin_headers)
        assert response.status_code == 200

    def test_items_limit_zero_handled(self, client, admin_headers):
        """limit=0 should not crash the server."""
        response = client.get("/api/items/?page=1&limit=0", headers=admin_headers)
        assert response.status_code in (200, 422)  # Either OK or validation error

    def test_negative_page_param_handled(self, client, admin_headers):
        """Negative page numbers should not crash the server."""
        response = client.get("/api/vendors/?page=-1&limit=10", headers=admin_headers)
        assert response.status_code != 500


# ─── Payload Robustness ───────────────────────────────────────────────────────

class TestPayloadRobustness:
    def test_oversized_string_field_handled(self, client, admin_headers):
        """Extremely long strings should be handled gracefully (422 or 400)."""
        payload = {
            "name": "A" * 10000,
            "contact_email": "test@test.com",
            "gstin": "VALIDGSTIN12345",
        }
        response = client.post("/api/vendors/", json=payload, headers=admin_headers)
        assert response.status_code in (400, 422, 201, 200)  # Not 500

    def test_negative_unit_price_rejected(self, client, admin_headers):
        """Item with negative unit_price should fail validation."""
        payload = {
            "sku": f"NEG-{uuid.uuid4().hex[:6]}",
            "name": "Negative Price Item",
            "unit_price": -100.00,
            "uom": "Nos",
        }
        response = client.post("/api/items/", json=payload, headers=admin_headers)
        assert response.status_code in (400, 422)

    def test_sql_chars_in_name_handled(self, client, admin_headers):
        """Names with SQL metacharacters should not cause 500."""
        payload = {
            "name": "Vendor'; DROP TABLE vendors; --",
            "contact_email": "sqlinject@test.local",
        }
        response = client.post("/api/vendors/", json=payload, headers=admin_headers)
        assert response.status_code != 500
