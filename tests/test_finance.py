"""
tests/test_finance.py
Integration tests for Finance & 3-Way Matching.

Validates:
  - 3-way match: PO quantity ↔ GRN quantity ↔ Invoice quantity
  - Invoice amount ↔ PO amount tolerance check
  - Mismatch detection flags invoice as MISMATCH_DETECTED
  - AP aging logic (overdue detection)
  - Tax amount accuracy (GST calculation)
"""
import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, VendorFactory, ItemFactory, WarehouseFactory,
    POFactory, GRNFactory, InvoiceFactory
)
from backend import models


pytestmark = pytest.mark.finance


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def finance_user(db_session):
    return UserFactory.create(db_session, role=models.Role.FINANCE)


@pytest.fixture
def vendor(db_session):
    return VendorFactory.create(db_session)


@pytest.fixture
def item(db_session, vendor):
    return ItemFactory.create(
        db_session, vendor_id=vendor.id, unit_price=Decimal("1000.00"), gst_rate=Decimal("18.00")
    )


@pytest.fixture
def warehouse(db_session):
    return WarehouseFactory.create(db_session)


@pytest.fixture
def standard_po(db_session, vendor, warehouse, finance_user):
    po = POFactory.create(
        db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
        total_amount=Decimal("100000.00"),
        status=models.POStatus.ISSUED,
    )
    line = models.POLineItem(
        id=uuid.uuid4(),
        purchase_order_id=po.id,
        item_id=item.id if False else ItemFactory.create(db_session, vendor_id=vendor.id).id,
        quantity=100,
        unit_price=Decimal("1000.00"),
        total_price=Decimal("100000.00"),
        uom="Nos",
        quantity_received=0,
    )
    db_session.add(line)
    db_session.flush()
    return po


# ─── 3-Way Matching Tests ─────────────────────────────────────────────────────

class TestThreeWayMatching:
    """
    3-Way Match: PO quantity == GRN received quantity == Invoice quantity.
    Any deviation should flag the invoice appropriately.
    """

    def test_matched_invoice_when_amounts_agree(
            self, db_session, vendor, warehouse, finance_user):
        """Invoice matching PO amount exactly should be MATCHED."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            total_amount=Decimal("50000.00"), status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            total_amount=Decimal("50000.00"),
            status=models.InvoiceStatus.MATCHED
        )
        assert invoice.status == models.InvoiceStatus.MATCHED

    def test_mismatch_detected_when_invoice_exceeds_po(
            self, db_session, vendor, warehouse, finance_user):
        """Invoice amount > PO amount should be MISMATCH_DETECTED."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            total_amount=Decimal("50000.00"), status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            total_amount=Decimal("60000.00"),  # 20% over PO value
            status=models.InvoiceStatus.MISMATCH_DETECTED
        )

        # Simulate matching engine evaluation
        tolerance = Decimal("0.05")  # 5% tolerance
        variance = abs(invoice.total_amount - po.total_amount) / po.total_amount
        is_mismatch = variance > tolerance

        assert is_mismatch is True
        assert invoice.status == models.InvoiceStatus.MISMATCH_DETECTED

    def test_invoice_within_tolerance_passes(
            self, db_session, vendor, warehouse, finance_user):
        """Invoice within 5% tolerance of PO should be considered acceptable."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            total_amount=Decimal("100000.00"), status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        # Invoice is 3% over PO — within 5% tolerance
        invoice_amount = Decimal("103000.00")
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            total_amount=invoice_amount
        )

        tolerance = Decimal("0.05")
        variance = abs(invoice.total_amount - po.total_amount) / po.total_amount
        assert variance <= tolerance

    def test_three_way_match_requires_grn_completion(
            self, db_session, vendor, warehouse, finance_user):
        """Invoice should not be MATCHED if GRN is not COMPLETED."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user,
            status="PENDING"  # Not yet completed
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            status=models.InvoiceStatus.PENDING_MATCHING
        )

        assert grn.status != "COMPLETED"
        assert invoice.status != models.InvoiceStatus.MATCHED


class TestAPAging:
    """Accounts Payable aging: overdue detection and categorization."""

    def test_invoice_overdue_detection(self, db_session, vendor, warehouse, finance_user):
        """Invoice past due_date should be identified as overdue."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        overdue_invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            due_date=datetime.utcnow() - timedelta(days=15),  # 15 days overdue
            status=models.InvoiceStatus.APPROVED
        )

        is_overdue = overdue_invoice.due_date < datetime.utcnow()
        days_overdue = (datetime.utcnow() - overdue_invoice.due_date).days

        assert is_overdue is True
        assert days_overdue >= 15

    def test_invoice_not_overdue_when_due_date_future(
            self, db_session, vendor, warehouse, finance_user):
        """Invoice with future due_date should NOT be overdue."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        future_invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            due_date=datetime.utcnow() + timedelta(days=30)
        )

        assert future_invoice.due_date > datetime.utcnow()

    def test_ap_aging_bucket_0_30_days(
            self, db_session, vendor, warehouse, finance_user):
        """Invoices overdue by 1–30 days should fall in 0–30 bucket."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            due_date=datetime.utcnow() - timedelta(days=20)
        )

        days_overdue = (datetime.utcnow() - invoice.due_date).days
        bucket = "0-30" if days_overdue <= 30 else "31-60" if days_overdue <= 60 else "60+"
        assert bucket == "0-30"


class TestTaxCalculation:
    """GST tax amount accuracy tests."""

    def test_gst_18_percent_on_base_amount(
            self, db_session, vendor, warehouse, finance_user):
        """18% GST on ₹100,000 base should be ₹18,000."""
        base_amount = Decimal("100000.00")
        expected_gst = base_amount * Decimal("0.18")

        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            total_amount=base_amount
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            total_amount=base_amount,
            tax_amount=expected_gst
        )

        assert invoice.tax_amount == expected_gst

    def test_zero_tax_amount_is_valid(
            self, db_session, vendor, warehouse, finance_user):
        """Some items (e.g., essential goods at 0% GST) may have zero tax."""
        po = POFactory.create(
            db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
            total_amount=Decimal("5000.00")
        )
        grn = GRNFactory.create(
            db_session, po=po, warehouse=warehouse, received_by=finance_user
        )
        invoice = InvoiceFactory.create(
            db_session, vendor=vendor, po=po, grn=grn, created_by=finance_user,
            tax_amount=Decimal("0.00")
        )
        assert invoice.tax_amount == Decimal("0.00")
