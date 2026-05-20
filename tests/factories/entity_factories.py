"""
tests/factories/entity_factories.py
Modular, reusable fixture factories for creating minimal ERP entities in tests.

Usage:
    from tests.factories.entity_factories import VendorFactory, ItemFactory

    vendor = VendorFactory.create(db_session)
    item   = ItemFactory.create(db_session, vendor_id=vendor.id)
"""
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend import models
from backend.auth_utils import hash_password


class UserFactory:
    """Create minimal User records."""
    _counter = 0

    @classmethod
    def create(cls, db: Session, role: models.Role = models.Role.BUYER, **kwargs) -> models.User:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            username=f"test_user_{n}",
            email=f"testuser{n}@erp-test.local",
            hashed_password=hash_password("Test@1234"),
            role=role,
            is_active=True,
        )
        defaults.update(kwargs)
        obj = models.User(**defaults)
        db.add(obj)
        db.flush()
        return obj


class DepartmentFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, **kwargs) -> models.Department:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            code=f"DEPT-{n:03d}",
            name=f"Test Department {n}",
        )
        defaults.update(kwargs)
        obj = models.Department(**defaults)
        db.add(obj)
        db.flush()
        return obj


class VendorFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, **kwargs) -> models.Vendor:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            name=f"Test Vendor {n} Pvt Ltd",
            contact_email=f"vendor{n}@test.local",
            default_lead_time_days=7,
            gstin=f"27TEST{n:04d}V1Z5",
            is_msme=False,
        )
        defaults.update(kwargs)
        obj = models.Vendor(**defaults)
        db.add(obj)
        db.flush()
        return obj


class ItemFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, vendor_id=None, **kwargs) -> models.Item:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            sku=f"TEST-SKU-{n:04d}",
            name=f"Test Item {n}",
            unit_price=Decimal("100.00"),
            gst_rate=Decimal("18.00"),
            uom="Nos",
            category="Test Category",
            default_vendor_id=vendor_id,
        )
        defaults.update(kwargs)
        obj = models.Item(**defaults)
        db.add(obj)
        db.flush()

        # Auto-create InventoryLedger for every item
        ledger = models.InventoryLedger(
            item_id=obj.id,
            quantity_on_hand=0,
            quantity_reserved=0,
            reorder_point=10,
        )
        db.add(ledger)
        db.flush()
        return obj


class WarehouseFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, **kwargs) -> models.Warehouse:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            name=f"Test Warehouse {n}",
            contact_name=f"Contact Person {n}",
            company_name="Test Logistics Pvt Ltd",
            address_line1=f"Plot {n}, Test Industrial Area",
            address_line2="Test District",
            city="Mumbai",
            state="Maharashtra",
            pin_code="400001",
            phone=f"022-{n:07d}",
        )
        defaults.update(kwargs)
        obj = models.Warehouse(**defaults)
        db.add(obj)
        db.flush()
        return obj


class POFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, vendor: models.Vendor,
               warehouse: models.Warehouse, created_by: models.User,
               **kwargs) -> models.PurchaseOrder:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            po_number=f"PO-FACT-{n:04d}",
            vendor_id=vendor.id,
            status=models.POStatus.ISSUED,
            workflow_state="APPROVED",
            total_amount=Decimal("5000.00"),
            order_date=datetime.utcnow(),
            expected_delivery_date=datetime.utcnow() + timedelta(days=30),
            warehouse_id=warehouse.id,
            ship_to_contact_name=warehouse.contact_name,
            ship_to_company_name=warehouse.company_name,
            ship_to_address_line1=warehouse.address_line1,
            ship_to_address_line2=warehouse.address_line2,
            ship_to_city=warehouse.city,
            ship_to_state=warehouse.state,
            ship_to_pin_code=warehouse.pin_code,
            ship_to_phone=warehouse.phone,
            created_by_id=created_by.id,
        )
        defaults.update(kwargs)
        obj = models.PurchaseOrder(**defaults)
        db.add(obj)
        db.flush()
        return obj


class GRNFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, po: models.PurchaseOrder,
               warehouse: models.Warehouse, received_by: models.User,
               **kwargs) -> models.GoodsReceiptNote:
        cls._counter += 1
        n = cls._counter
        defaults = dict(
            id=uuid.uuid4(),
            grn_number=f"GRN-FACT-{n:04d}",
            purchase_order_id=po.id,
            vendor_id=po.vendor_id,
            warehouse_id=warehouse.id,
            status="COMPLETED",
            receipt_date=datetime.utcnow(),
            received_by_id=received_by.id,
        )
        defaults.update(kwargs)
        obj = models.GoodsReceiptNote(**defaults)
        db.add(obj)
        db.flush()
        return obj


class InvoiceFactory:
    _counter = 0

    @classmethod
    def create(cls, db: Session, vendor: models.Vendor,
               po: models.PurchaseOrder, grn: models.GoodsReceiptNote,
               created_by: models.User, **kwargs) -> models.Invoice:
        cls._counter += 1
        n = cls._counter
        total = po.total_amount
        defaults = dict(
            id=uuid.uuid4(),
            invoice_number=f"INV-FACT-{n:04d}",
            vendor_id=vendor.id,
            purchase_order_id=po.id,
            grn_id=grn.id,
            status=models.InvoiceStatus.PENDING_MATCHING,
            invoice_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=30),
            total_amount=total,
            tax_amount=total * Decimal("0.18"),
            created_by_id=created_by.id,
        )
        defaults.update(kwargs)
        obj = models.Invoice(**defaults)
        db.add(obj)
        db.flush()
        return obj
