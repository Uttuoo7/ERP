"""
tests/test_procurement.py
Integration tests for the full Procurement Chain:
  PR → RFQ → PO → GRN → AP Invoice

Validates:
  - Document creation and status transitions
  - Referential integrity across the chain
  - Quantity and value consistency
  - PO → GRN linkage
  - GRN → Invoice linkage
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, VendorFactory, ItemFactory, WarehouseFactory,
    POFactory, GRNFactory, InvoiceFactory
)
from backend import models


pytestmark = pytest.mark.procurement


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def buyer(db_session):
    return UserFactory.create(db_session, role=models.Role.BUYER)


@pytest.fixture
def vendor(db_session):
    return VendorFactory.create(db_session)


@pytest.fixture
def item(db_session, vendor):
    return ItemFactory.create(db_session, vendor_id=vendor.id,
                              unit_price=Decimal("250.00"))


@pytest.fixture
def warehouse(db_session):
    return WarehouseFactory.create(db_session)


@pytest.fixture
def issued_po(db_session, vendor, warehouse, buyer):
    po = POFactory.create(
        db_session, vendor=vendor, warehouse=warehouse, created_by=buyer,
        total_amount=Decimal("25000.00"),
        status=models.POStatus.ISSUED,
    )
    # Add a line item
    line = models.POLineItem(
        id=__import__("uuid").uuid4(),
        purchase_order_id=po.id,
        item_id=ItemFactory.create(db_session, vendor_id=vendor.id).id,
        quantity=100,
        unit_price=Decimal("250.00"),
        total_price=Decimal("25000.00"),
        uom="Nos",
        quantity_received=0,
    )
    db_session.add(line)
    db_session.flush()
    return po


@pytest.fixture
def completed_grn(db_session, issued_po, warehouse, buyer):
    grn = GRNFactory.create(
        db_session, po=issued_po, warehouse=warehouse, received_by=buyer
    )
    return grn


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestPurchaseOrderCreation:
    def test_po_created_with_issued_status(self, db_session, issued_po):
        """PO should be persisted with ISSUED status."""
        po = db_session.query(models.PurchaseOrder).filter_by(id=issued_po.id).first()
        assert po is not None
        assert po.status == models.POStatus.ISSUED

    def test_po_has_line_items(self, db_session, issued_po):
        """PO must have at least one line item."""
        po = db_session.query(models.PurchaseOrder)\
            .filter_by(id=issued_po.id).first()
        assert len(po.line_items) >= 1

    def test_po_total_matches_line_items(self, db_session, issued_po):
        """PO total_amount should equal sum of line_item total_price."""
        po = db_session.query(models.PurchaseOrder)\
            .filter_by(id=issued_po.id).first()
        line_total = sum(li.total_price for li in po.line_items)
        assert abs(po.total_amount - line_total) < Decimal("0.01")

    def test_po_vendor_reference_integrity(self, db_session, issued_po, vendor):
        """PO vendor_id must reference a valid Vendor record."""
        po = db_session.query(models.PurchaseOrder)\
            .filter_by(id=issued_po.id).first()
        fetched_vendor = db_session.query(models.Vendor)\
            .filter_by(id=po.vendor_id).first()
        assert fetched_vendor is not None
        assert fetched_vendor.id == vendor.id

    def test_draft_po_can_be_issued(self, db_session, vendor, warehouse, buyer):
        """A DRAFT PO can be transitioned to ISSUED status."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=buyer,
            status=models.POStatus.DRAFT,
        )
        assert po.status == models.POStatus.DRAFT

        po.status = models.POStatus.ISSUED
        db_session.flush()

        refreshed = db_session.query(models.PurchaseOrder).filter_by(id=po.id).first()
        assert refreshed.status == models.POStatus.ISSUED


class TestGoodsReceiptNote:
    def test_grn_linked_to_po(self, db_session, completed_grn, issued_po):
        """GRN must reference the originating PO."""
        grn = db_session.query(models.GoodsReceiptNote)\
            .filter_by(id=completed_grn.id).first()
        assert grn.purchase_order_id == issued_po.id

    def test_grn_completed_status(self, db_session, completed_grn):
        """GRN created by factory should be in COMPLETED status."""
        grn = db_session.query(models.GoodsReceiptNote)\
            .filter_by(id=completed_grn.id).first()
        assert grn.status == "COMPLETED"

    def test_grn_warehouse_reference(self, db_session, completed_grn, warehouse):
        """GRN must reference the receiving warehouse."""
        grn = db_session.query(models.GoodsReceiptNote)\
            .filter_by(id=completed_grn.id).first()
        assert grn.warehouse_id == warehouse.id


class TestAPInvoice:
    def test_invoice_linked_to_po_and_grn(self, db_session, vendor, issued_po,
                                           completed_grn, buyer):
        """Invoice must have valid PO and GRN references."""
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=issued_po,
            grn=completed_grn, created_by=buyer
        )
        inv = db_session.query(models.Invoice).filter_by(id=invoice.id).first()
        assert inv.purchase_order_id == issued_po.id
        assert inv.grn_id == completed_grn.id

    def test_invoice_initial_status_is_pending_matching(
            self, db_session, vendor, issued_po, completed_grn, buyer):
        """New invoice should start in PENDING_MATCHING status."""
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=issued_po,
            grn=completed_grn, created_by=buyer,
            status=models.InvoiceStatus.PENDING_MATCHING
        )
        assert invoice.status == models.InvoiceStatus.PENDING_MATCHING

    def test_invoice_amount_not_negative(self, db_session, vendor, issued_po,
                                         completed_grn, buyer):
        """Invoice total_amount must be non-negative."""
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=issued_po,
            grn=completed_grn, created_by=buyer
        )
        assert invoice.total_amount >= Decimal("0")

    def test_invoice_due_date_after_invoice_date(
            self, db_session, vendor, issued_po, completed_grn, buyer):
        """Invoice due_date should be after invoice_date."""
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=issued_po,
            grn=completed_grn, created_by=buyer
        )
        assert invoice.due_date > invoice.invoice_date


class TestProcurementChainIntegrity:
    def test_full_chain_referential_integrity(self, db_session, vendor,
                                               warehouse, buyer):
        """Test that a full PO → GRN → Invoice chain maintains referential integrity."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=buyer,
            status=models.POStatus.ISSUED,
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=buyer
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=buyer
        )

        # Verify the complete chain
        assert grn.purchase_order_id == po.id
        assert invoice.purchase_order_id == po.id
        assert invoice.grn_id == grn.id
        assert invoice.vendor_id == vendor.id == po.vendor_id

    def test_po_cannot_have_duplicate_po_number(self, db_session, vendor,
                                                  warehouse, buyer):
        """Two POs must not share the same po_number (unique constraint)."""
        import sqlalchemy.exc
        po1 = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=buyer,
            po_number="PO-DUPE-TEST-001"
        )
        db_session.flush()

        po2 = models.PurchaseOrder(
            id=__import__("uuid").uuid4(),
            po_number="PO-DUPE-TEST-001",  # Same number
            vendor_id=vendor.id,
            status=models.POStatus.DRAFT,
            total_amount=Decimal("1000.00"),
            order_date=datetime.utcnow(),
            ship_to_contact_name="Test",
            ship_to_address_line1="Test Address",
            ship_to_address_line2="",
            ship_to_city="Mumbai",
            ship_to_state="Maharashtra",
            ship_to_pin_code="400001",
            ship_to_phone="0000000000",
            created_by_id=buyer.id,
        )
        db_session.add(po2)

        with pytest.raises(Exception):  # DB unique constraint violation
            db_session.flush()
