import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import enum

from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

class Base(DeclarativeBase):
    pass

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIAL_RECEIPT = "PARTIAL_RECEIPT"
    FULFILLED = "FULFILLED"
    CLOSED = "CLOSED"

class InvoiceStatus(str, enum.Enum):
    PENDING = "PENDING"
    MATCHED = "MATCHED"
    DISCREPANCY = "DISCREPANCY"
    PAID = "PAID"

class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    BUYER = "BUYER"
    WAREHOUSE = "WAREHOUSE"
    FINANCE = "FINANCE"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.BUYER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), index=True)
    contact_email: Mapped[str] = mapped_column(String(100))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    default_lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), unique=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), unique=True)
    is_msme: Mapped[bool] = mapped_column(Boolean, default=False)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[List["Item"]] = relationship(back_populates="default_vendor")
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(back_populates="vendor")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="vendor")

class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    contact_name: Mapped[str] = mapped_column(String(100))
    company_name: Mapped[str] = mapped_column(String(100))
    address_line1: Mapped[str] = mapped_column(String(255))
    address_line2: Mapped[str] = mapped_column(String(255))
    landmark: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    pin_code: Mapped[str] = mapped_column(String(20))
    phone: Mapped[str] = mapped_column(String(50))
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(String(255))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    default_vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(50), default="Raw Component")
    uom: Mapped[str] = mapped_column(String(20), default="Nos")
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18.00)
    mpn: Mapped[Optional[str]] = mapped_column(String(100))
    oem: Mapped[Optional[str]] = mapped_column(String(100))
    footprint: Mapped[Optional[str]] = mapped_column(String(50))
    bin_location: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    default_vendor: Mapped[Optional["Vendor"]] = relationship(back_populates="items")
    inventory_ledger: Mapped["InventoryLedger"] = relationship(back_populates="item", uselist=False)

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    transaction_type: Mapped[str] = mapped_column(String(50))
    quantity: Mapped[int] = mapped_column(Integer)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    item: Mapped["Item"] = relationship()

class InventoryLedger(Base):
    __tablename__ = "inventory_ledger"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), primary_key=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item: Mapped["Item"] = relationship(back_populates="inventory_ledger")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"))
    source_so_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("internal_sales_orders.id"))
    status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.DRAFT)
    order_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expected_delivery_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    
    delivery_type: Mapped[str] = mapped_column(String(50), default="Warehouse")
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"))
    ship_to_contact_name: Mapped[str] = mapped_column(String(100))
    ship_to_company_name: Mapped[Optional[str]] = mapped_column(String(100))
    ship_to_address_line1: Mapped[str] = mapped_column(String(255))
    ship_to_address_line2: Mapped[str] = mapped_column(String(255))
    ship_to_landmark: Mapped[Optional[str]] = mapped_column(String(100))
    ship_to_city: Mapped[str] = mapped_column(String(100))
    ship_to_state: Mapped[str] = mapped_column(String(100))
    ship_to_pin_code: Mapped[str] = mapped_column(String(20))
    ship_to_phone: Mapped[str] = mapped_column(String(50))

    vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
    line_items: Mapped[List["POLineItem"]] = relationship(back_populates="purchase_order")
    goods_receipt_notes: Mapped[List["GoodsReceiptNote"]] = relationship(back_populates="purchase_order")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="purchase_order")

class POLineItem(Base):
    __tablename__ = "po_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    quantity_ordered: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    quantity_billed: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="line_items")
    item: Mapped["Item"] = relationship()
    grn_line_items: Mapped[List["GRNLineItem"]] = relationship(back_populates="po_line_item")
    invoice_line_items: Mapped[List["InvoiceLineItem"]] = relationship(back_populates="po_line_item")

class GoodsReceiptNote(Base):
    __tablename__ = "goods_receipt_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    receipt_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    received_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="goods_receipt_notes")
    received_by: Mapped[Optional["User"]] = relationship()
    line_items: Mapped[List["GRNLineItem"]] = relationship(back_populates="goods_receipt_note")

class GRNLineItem(Base):
    __tablename__ = "grn_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("goods_receipt_notes.id"))
    po_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("po_line_items.id"))
    quantity_received: Mapped[int] = mapped_column(Integer)
    is_quality_approved: Mapped[bool] = mapped_column(Boolean, default=True)

    goods_receipt_note: Mapped["GoodsReceiptNote"] = relationship(back_populates="line_items")
    po_line_item: Mapped["POLineItem"] = relationship(back_populates="grn_line_items")

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    invoice_number: Mapped[str] = mapped_column(String(50), index=True)
    invoice_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tds_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="invoices")
    vendor: Mapped["Vendor"] = relationship(back_populates="invoices")
    line_items: Mapped[List["InvoiceLineItem"]] = relationship(back_populates="invoice")

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    po_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("po_line_items.id"))
    quantity_billed: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")
    po_line_item: Mapped["POLineItem"] = relationship(back_populates="invoice_line_items")

class InternalSalesOrder(Base):
    __tablename__ = "internal_sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    so_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    requester_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, APPROVED, CONVERTED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    delivery_type: Mapped[str] = mapped_column(String(50), default="Warehouse")
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"))
    ship_to_contact_name: Mapped[str] = mapped_column(String(100))
    ship_to_company_name: Mapped[Optional[str]] = mapped_column(String(100))
    ship_to_address_line1: Mapped[str] = mapped_column(String(255))
    ship_to_address_line2: Mapped[str] = mapped_column(String(255))
    ship_to_landmark: Mapped[Optional[str]] = mapped_column(String(100))
    ship_to_city: Mapped[str] = mapped_column(String(100))
    ship_to_state: Mapped[str] = mapped_column(String(100))
    ship_to_pin_code: Mapped[str] = mapped_column(String(20))
    ship_to_phone: Mapped[str] = mapped_column(String(50))

    line_items: Mapped[List["SOLineItem"]] = relationship(back_populates="sales_order")
    requester: Mapped[Optional["User"]] = relationship()

class SOLineItem(Base):
    __tablename__ = "so_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    so_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internal_sales_orders.id"))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(String(255))

    sales_order: Mapped["InternalSalesOrder"] = relationship(back_populates="line_items")
    item: Mapped["Item"] = relationship()

class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(100))
    source_type: Mapped[str] = mapped_column(String(50)) # PURCHASE_ORDER, SALES_ORDER
    po_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("purchase_orders.id"))
    so_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("internal_sales_orders.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
