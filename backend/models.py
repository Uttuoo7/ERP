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
    DRAFT = "DRAFT"
    PENDING_MATCHING = "PENDING_MATCHING"
    MATCHED = "MATCHED"
    MISMATCH_DETECTED = "MISMATCH_DETECTED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    POSTED = "POSTED"
    PAID = "PAID"
    CLOSED = "CLOSED"
    
    # Keep legacy mappings for potential standard queries
    PENDING = "PENDING"
    DISCREPANCY = "DISCREPANCY"

class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    BUYER = "BUYER"
    WAREHOUSE = "WAREHOUSE"
    FINANCE = "FINANCE"
    PROCUREMENT_MANAGER = "PROCUREMENT_MANAGER"
    FINANCE_MANAGER = "FINANCE_MANAGER"
    WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER"
    EMPLOYEE = "EMPLOYEE"
    AUDITOR = "AUDITOR"
    VENDOR = "VENDOR"
    SUPER_ADMIN = "SUPER_ADMIN"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.BUYER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class BaseMaster(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

class Department(BaseMaster):
    __tablename__ = "departments"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

class CostCenter(BaseMaster):
    __tablename__ = "cost_centers"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))

class Project(BaseMaster):
    __tablename__ = "projects"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class Employee(BaseMaster):
    __tablename__ = "employees"
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(50), index=True)
    last_name: Mapped[str] = mapped_column(String(50), index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

class Customer(BaseMaster):
    __tablename__ = "customers"
    customer_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    gstin: Mapped[Optional[str]] = mapped_column(String(15), unique=True, nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), unique=True, nullable=True)

class Vendor(BaseMaster):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(100), index=True)
    contact_email: Mapped[str] = mapped_column(String(100))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    default_lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), unique=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), unique=True)
    is_msme: Mapped[bool] = mapped_column(Boolean, default=False)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20))

    items: Mapped[List["Item"]] = relationship(back_populates="default_vendor")
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(back_populates="vendor")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="vendor")

class Warehouse(BaseMaster):
    __tablename__ = "warehouses"

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

class Item(BaseMaster):
    __tablename__ = "items"

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

    default_vendor: Mapped[Optional["Vendor"]] = relationship(back_populates="items")
    inventory_ledger: Mapped["InventoryLedger"] = relationship(back_populates="item", uselist=False)

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(50)) # RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, RETURN, DAMAGE, RESERVATION
    quantity: Mapped[int] = mapped_column(Integer)
    valuation_unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    remarks: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    item: Mapped["Item"] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()
    batch: Mapped[Optional["InventoryBatch"]] = relationship()
    created_by: Mapped[Optional["User"]] = relationship()

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    batch_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    item: Mapped["Item"] = relationship()

class InventorySerial(Base):
    __tablename__ = "inventory_serials"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="AVAILABLE") # AVAILABLE, RESERVED, DAMAGED, ISSUED
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    
    item: Mapped["Item"] = relationship()
    batch: Mapped[Optional["InventoryBatch"]] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()

class WarehouseStock(Base):
    __tablename__ = "warehouse_stock"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    quantity_damaged: Mapped[int] = mapped_column(Integer, default=0)
    quantity_transit: Mapped[int] = mapped_column(Integer, default=0)
    valuation_unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    
    warehouse: Mapped["Warehouse"] = relationship()
    item: Mapped["Item"] = relationship()
    batch: Mapped[Optional["InventoryBatch"]] = relationship()

class StockLedgerEntry(Base):
    __tablename__ = "stock_ledger_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(50)) # RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, RETURN, DAMAGE, RESERVATION
    quantity_change: Mapped[int] = mapped_column(Integer)
    resulting_on_hand: Mapped[int] = mapped_column(Integer)
    valuation_unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    reference_type: Mapped[str] = mapped_column(String(50)) # GRN, STOCK_TRANSFER, ADJUSTMENT, etc.
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    remarks: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    item: Mapped["Item"] = relationship()
    warehouse: Mapped["Warehouse"] = relationship()
    batch: Mapped[Optional["InventoryBatch"]] = relationship()
    created_by: Mapped[Optional["User"]] = relationship()

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
    linked_rfq_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("rfqs.id"), nullable=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("cost_centers.id"), nullable=True)
    
    status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.DRAFT)
    workflow_state: Mapped[str] = mapped_column(String(50), default="PENDING")
    amendment_version: Mapped[int] = mapped_column(Integer, default=0)
    
    order_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expected_delivery_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    delivery_terms: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    tax_summary: Mapped[Optional[str]] = mapped_column(String(1000), default="0.0")
    discount_summary: Mapped[Optional[str]] = mapped_column(String(1000), default="0.0")
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

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_id])
    updated_by: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by_id])
    line_items: Mapped[List["POLineItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")
    goods_receipt_notes: Mapped[List["GoodsReceiptNote"]] = relationship(back_populates="purchase_order")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="purchase_order")
    rfq: Mapped[Optional["RequestForQuotation"]] = relationship()
    department: Mapped[Optional["Department"]] = relationship()
    project: Mapped[Optional["Project"]] = relationship()
    cost_center: Mapped[Optional["CostCenter"]] = relationship()
    amendments: Mapped[List["PurchaseOrderAmendment"]] = relationship("PurchaseOrderAmendment", back_populates="purchase_order", cascade="all, delete-orphan")

class POLineItem(Base):
    __tablename__ = "po_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    rfq_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("rfq_lines.id"), nullable=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    quantity_ordered: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    taxes: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.0)
    discounts: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.0)
    delivery_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    quantity_billed: Mapped[int] = mapped_column(Integer, default=0)
    remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="line_items")
    item: Mapped["Item"] = relationship()
    grn_line_items: Mapped[List["GRNLineItem"]] = relationship(back_populates="po_line_item")
    invoice_line_items: Mapped[List["InvoiceLineItem"]] = relationship(back_populates="po_line_item")
    rfq_line: Mapped[Optional["RequestForQuotationLine"]] = relationship()

class PurchaseOrderAmendment(Base):
    __tablename__ = "po_amendments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    amendment_number: Mapped[int] = mapped_column(Integer)
    change_reason: Mapped[str] = mapped_column(String(500))
    snapshot_data: Mapped[str] = mapped_column(String(15000)) # holds full JSON dump of PO header and lines before amendment
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="amendments")
    created_by: Mapped["User"] = relationship()

class GoodsReceiptNote(Base):
    __tablename__ = "goods_receipt_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    received_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    vehicle_details: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    delivery_challan_number: Mapped[str] = mapped_column(String(100))
    receipt_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default="QC_PENDING") # DRAFT, RECEIVED, QC_PENDING, PARTIALLY_ACCEPTED, FULLY_ACCEPTED, REJECTED, CLOSED
    workflow_state: Mapped[str] = mapped_column(String(50), default="PENDING")
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Inspection parameters
    inspected_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    inspection_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    inspection_remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="goods_receipt_notes")
    received_by: Mapped[Optional["User"]] = relationship(foreign_keys=[received_by_id])
    inspected_by: Mapped[Optional["User"]] = relationship(foreign_keys=[inspected_by_id])
    vendor: Mapped[Optional["Vendor"]] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()
    line_items: Mapped[List["GRNLineItem"]] = relationship(back_populates="goods_receipt_note", cascade="all, delete-orphan")

class GRNLineItem(Base):
    __tablename__ = "grn_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("goods_receipt_notes.id"))
    po_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("po_line_items.id"))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    
    quantity_ordered: Mapped[int] = mapped_column(Integer)
    quantity_received: Mapped[int] = mapped_column(Integer)
    quantity_accepted: Mapped[int] = mapped_column(Integer, default=0)
    quantity_rejected: Mapped[int] = mapped_column(Integer, default=0)
    quantity_damaged: Mapped[int] = mapped_column(Integer, default=0)
    remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    
    # Lot / Serial parameters
    batch_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    serial_numbers: Mapped[Optional[str]] = mapped_column(String(15000), nullable=True) # JSON list
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    warehouse_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    inspection_remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    goods_receipt_note: Mapped["GoodsReceiptNote"] = relationship(back_populates="line_items")
    po_line_item: Mapped["POLineItem"] = relationship(back_populates="grn_line_items")
    item: Mapped["Item"] = relationship()

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_orders.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    grn_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("goods_receipt_notes.id"), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(50), index=True)
    vendor_invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tds_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    workflow_state: Mapped[Optional[str]] = mapped_column(String(100), default="DRAFT")
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="invoices")
    vendor: Mapped["Vendor"] = relationship(back_populates="invoices")
    goods_receipt_note: Mapped[Optional["GoodsReceiptNote"]] = relationship()
    line_items: Mapped[List["InvoiceLineItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    po_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("po_line_items.id"))
    grn_line_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("grn_line_items.id"), nullable=True)
    quantity_billed: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    variance_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    match_status: Mapped[str] = mapped_column(String(50), default="PENDING_MATCHING")

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")
    po_line_item: Mapped["POLineItem"] = relationship(back_populates="invoice_line_items")
    grn_line_item: Mapped[Optional["GRNLineItem"]] = relationship()

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
    
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    line_items: Mapped[List["SOLineItem"]] = relationship(back_populates="sales_order")
    requester: Mapped[Optional["User"]] = relationship(foreign_keys=[requester_id])
    updated_by: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by_id])

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

# -- Workflow Engine Models --

class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str] = mapped_column(String(50), index=True) # e.g. PURCHASE_ORDER, VENDOR_APPROVAL
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    steps: Mapped[List["WorkflowStep"]] = relationship("WorkflowStep", back_populates="definition", cascade="all, delete-orphan")

class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_definitions.id"))
    step_number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(100))
    role_required: Mapped[str] = mapped_column(String(50)) # e.g. BUYER, FINANCE, ADMIN
    condition_expression: Mapped[Optional[str]] = mapped_column(String(255)) # e.g. amount > 50000
    escalation_timeout_hours: Mapped[Optional[int]] = mapped_column(Integer)

    definition: Mapped["WorkflowDefinition"] = relationship("WorkflowDefinition", back_populates="steps")

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_definition_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_definitions.id"))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True) # ID of target PO, SO, etc.
    current_step_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default="PENDING_APPROVAL") # PENDING_APPROVAL, APPROVED, REJECTED, ESCALATED, CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks: Mapped[List["ApprovalTask"]] = relationship("ApprovalTask", back_populates="instance")
    history: Mapped[List["WorkflowHistory"]] = relationship("WorkflowHistory", back_populates="instance")

class ApprovalTask(Base):
    __tablename__ = "approval_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_instance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_instances.id"))
    step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_steps.id"))
    assigned_role: Mapped[str] = mapped_column(String(50))
    assigned_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, ESCALATED
    comments: Mapped[Optional[str]] = mapped_column(String(500))
    actioned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actioned_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="tasks")
    step: Mapped["WorkflowStep"] = relationship("WorkflowStep")

class WorkflowHistory(Base):
    __tablename__ = "workflow_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_instance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow_instances.id"))
    transition_from: Mapped[str] = mapped_column(String(50))
    transition_to: Mapped[str] = mapped_column(String(50))
    actioned_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    instance: Mapped["WorkflowInstance"] = relationship("WorkflowInstance", back_populates="history")

# -- Purchase Requisitions (PR) Module --

class PurchaseRequisition(Base):
    __tablename__ = "purchase_requisitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("cost_centers.id"), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, URGENT
    required_date: Mapped[datetime] = mapped_column(DateTime)
    delivery_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    remarks: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, SUBMITTED, PENDING_APPROVAL, APPROVED, REJECTED, PARTIALLY_CONVERTED, FULLY_CONVERTED, CANCELLED, CLOSED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    requester: Mapped["User"] = relationship("User", foreign_keys=[requester_id])
    department: Mapped[Optional["Department"]] = relationship("Department")
    project: Mapped[Optional["Project"]] = relationship("Project")
    cost_center: Mapped[Optional["CostCenter"]] = relationship("CostCenter")
    delivery_location: Mapped[Optional["Warehouse"]] = relationship("Warehouse")
    line_items: Mapped[List["PurchaseRequisitionLine"]] = relationship("PurchaseRequisitionLine", back_populates="requisition", cascade="all, delete-orphan")
    comments: Mapped[List["PurchaseRequisitionComment"]] = relationship("PurchaseRequisitionComment", back_populates="requisition", cascade="all, delete-orphan")
    audits: Mapped[List["PurchaseRequisitionAudit"]] = relationship("PurchaseRequisitionAudit", back_populates="requisition", cascade="all, delete-orphan")

class PurchaseRequisitionLine(Base):
    __tablename__ = "purchase_requisition_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_requisitions.id"))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    description: Mapped[Optional[str]] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer)
    uom: Mapped[str] = mapped_column(String(20)) # Unit of Measure
    estimated_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    suggested_vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    required_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(255))
    budget_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tax_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    requisition: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="line_items")
    item: Mapped["Item"] = relationship("Item")
    suggested_vendor: Mapped[Optional["Vendor"]] = relationship("Vendor")

class PurchaseRequisitionComment(Base):
    __tablename__ = "purchase_requisition_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_requisitions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    comment: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requisition: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="comments")
    user: Mapped["User"] = relationship("User")

class PurchaseRequisitionAudit(Base):
    __tablename__ = "purchase_requisition_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("purchase_requisitions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50)) # e.g. CREATED, SUBMITTED, UPDATED_LINE, APPROVED
    details: Mapped[Optional[str]] = mapped_column(String(1000)) # Change summaries
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requisition: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="audits")
    user: Mapped["User"] = relationship("User")

# -- Universal Document Traceability & Relationship System --

class DocumentRelationship(Base):
    __tablename__ = "document_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(50), index=True) # e.g. PURCHASE_REQUISITION, PURCHASE_ORDER, RFQ, INVOICE
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    target_type: Mapped[str] = mapped_column(String(50), index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    relationship_type: Mapped[str] = mapped_column(String(50), default="CONVERSION") # CONVERSION, REFERENCE
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    created_by: Mapped["User"] = relationship("User")
    line_links: Mapped[List["DocumentLineRelationship"]] = relationship("DocumentLineRelationship", back_populates="relationship", cascade="all, delete-orphan")

class DocumentLineRelationship(Base):
    __tablename__ = "document_line_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_relationship_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("document_relationships.id"))
    source_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    target_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    quantity_converted: Mapped[Decimal] = mapped_column(Numeric(15, 4))
    conversion_status: Mapped[str] = mapped_column(String(50), default="COMPLETED") # COMPLETED, PARTIAL
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    created_by: Mapped["User"] = relationship("User")
    relationship: Mapped["DocumentRelationship"] = relationship("DocumentRelationship", back_populates="line_links")

# -- Request For Quotation (RFQ) Module Models --

class RequestForQuotation(Base):
    __tablename__ = "rfqs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    buyer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    payment_terms: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    delivery_terms: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, SENT, PARTIALLY_RESPONDED, FULLY_RESPONDED, UNDER_EVALUATION, APPROVED, CANCELLED, CLOSED
    workflow_state: Mapped[str] = mapped_column(String(50), default="PENDING")
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    buyer: Mapped["User"] = relationship("User", foreign_keys=[buyer_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    department: Mapped[Optional["Department"]] = relationship("Department")
    line_items: Mapped[List["RequestForQuotationLine"]] = relationship("RequestForQuotationLine", back_populates="rfq", cascade="all, delete-orphan")
    invitations: Mapped[List["RFQVendorInvitation"]] = relationship("RFQVendorInvitation", back_populates="rfq", cascade="all, delete-orphan")
    quotations: Mapped[List["VendorQuotation"]] = relationship("VendorQuotation", back_populates="rfq", cascade="all, delete-orphan")

class RequestForQuotationLine(Base):
    __tablename__ = "rfq_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rfqs.id"))
    pr_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("purchase_requisition_lines.id"), nullable=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(15, 4))
    uom: Mapped[str] = mapped_column(String(50), default="Units")
    required_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    estimated_budget: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    technical_specifications: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    vendor_notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    rfq: Mapped["RequestForQuotation"] = relationship("RequestForQuotation", back_populates="line_items")
    item: Mapped["Item"] = relationship("Item")
    pr_line: Mapped[Optional["PurchaseRequisitionLine"]] = relationship("PurchaseRequisitionLine")

class RFQVendorInvitation(Base):
    __tablename__ = "rfq_vendor_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rfqs.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    invitation_status: Mapped[str] = mapped_column(String(50), default="INVITED") # INVITED, VIEWED, RESPONDED, DECLINED, EXPIRED
    invited_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    response_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    rfq: Mapped["RequestForQuotation"] = relationship("RequestForQuotation", back_populates="invitations")
    vendor: Mapped["Vendor"] = relationship("Vendor")

class VendorQuotation(Base):
    __tablename__ = "vendor_quotations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rfqs.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    invitation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("rfq_vendor_invitations.id"), nullable=True)
    quotation_number: Mapped[str] = mapped_column(String(100), index=True)
    total_quoted_price: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    taxes: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    discounts: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)
    delivery_commitment: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    validity_date: Mapped[datetime] = mapped_column(DateTime)
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    rfq: Mapped["RequestForQuotation"] = relationship("RequestForQuotation", back_populates="quotations")
    vendor: Mapped["Vendor"] = relationship("Vendor")
    invitation: Mapped[Optional["RFQVendorInvitation"]] = relationship("RFQVendorInvitation")
    created_by: Mapped["User"] = relationship("User")
    line_items: Mapped[List["VendorQuotationLine"]] = relationship("VendorQuotationLine", back_populates="quotation", cascade="all, delete-orphan")

class VendorQuotationLine(Base):
    __tablename__ = "vendor_quotation_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_quotation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendor_quotations.id"))
    rfq_line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rfq_lines.id"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 4))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0) # Tax %
    discount_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0) # Discount %
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)
    vendor_remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    quotation: Mapped["VendorQuotation"] = relationship("VendorQuotation", back_populates="line_items")
    rfq_line: Mapped["RequestForQuotationLine"] = relationship("RequestForQuotationLine")

# --- Universal Financial Transaction Layer ---
class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    transaction_type: Mapped[str] = mapped_column(String(50)) # AP_INVOICE, PAYMENT, CREDIT_NOTE, DEBIT_NOTE, TAX, ACCRUAL, ADJUSTMENT
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    reference_type: Mapped[str] = mapped_column(String(50)) # INVOICE, PAYMENT
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[str] = mapped_column(String(50), default="POSTED") # POSTED, REVERSED
    
    # Accounting Dimensions
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("cost_centers.id"), nullable=True)
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_id])
    department: Mapped[Optional["Department"]] = relationship()
    project: Mapped[Optional["Project"]] = relationship()
    cost_center: Mapped[Optional["CostCenter"]] = relationship()
    vendor: Mapped[Optional["Vendor"]] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()
    
    ledger_entries: Mapped[List["LedgerEntry"]] = relationship("LedgerEntry", back_populates="financial_transaction", cascade="all, delete-orphan")
    tax_entries: Mapped[List["TaxEntry"]] = relationship("TaxEntry", back_populates="financial_transaction", cascade="all, delete-orphan")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    financial_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_transactions.id"))
    account_name: Mapped[str] = mapped_column(String(100)) # e.g. Creditors Control, Purchase Account, GST Receivable, TDS Payable
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    narration: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    financial_transaction: Mapped["FinancialTransaction"] = relationship("FinancialTransaction", back_populates="ledger_entries")

class TaxEntry(Base):
    __tablename__ = "tax_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    financial_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_transactions.id"))
    tax_type: Mapped[str] = mapped_column(String(50)) # GST, CGST, SGST, IGST, TDS
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    tax_ledger_name: Mapped[str] = mapped_column(String(100))

    financial_transaction: Mapped["FinancialTransaction"] = relationship("FinancialTransaction", back_populates="tax_entries")

class VendorLiability(Base):
    __tablename__ = "vendor_liabilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    original_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    due_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(50), default="UNPAID") # UNPAID, PARTIALLY_PAID, PAID
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    vendor: Mapped["Vendor"] = relationship()
    invoice: Mapped["Invoice"] = relationship()

class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    financial_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_transactions.id")) # Refers to PAYMENT transaction
    vendor_liability_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendor_liabilities.id"))
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    allocation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    financial_transaction: Mapped["FinancialTransaction"] = relationship()
    vendor_liability: Mapped["VendorLiability"] = relationship()

class TallySyncQueue(Base):
    __tablename__ = "tally_sync_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    financial_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_transactions.id"))
    sync_status: Mapped[str] = mapped_column(String(50), default="PENDING") # PENDING, SYNCED, FAILED
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    payload_xml: Mapped[str] = mapped_column(String(30000)) # holds prepared Tally Gateway XML
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    financial_transaction: Mapped["FinancialTransaction"] = relationship()

class AuditSecurityLog(Base):
    __tablename__ = "audit_security_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100)) # e.g. LOGIN_FAILED, ACCESS_BLOCKED, ROLE_MUTATION
    details: Mapped[str] = mapped_column(String(1000))
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship()

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(String(1000))
    type: Mapped[str] = mapped_column(String(50), default="INFO") # INFO, WARNING, ERROR, SUCCESS, CRITICAL
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[str] = mapped_column(String(50), default="MEDIUM") # LOW, MEDIUM, HIGH, URGENT
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship()

class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    metric_key: Mapped[str] = mapped_column(String(100)) # e.g. spend, liability, delayed, low_stock
    metric_value: Mapped[float] = mapped_column(Numeric)
    dimension_tag: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
