import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import enum

from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, ForeignKey, Enum, Text, Float, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SYSTEM_DEFAULT_TENANT_UUID = uuid.UUID("00000000-0000-0000-0000-000000000000")

class Base(DeclarativeBase):
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True, default=SYSTEM_DEFAULT_TENANT_UUID)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

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
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("companies.id"), nullable=True)
    branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("branches.id"), nullable=True)
    vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    subscription_plan: Mapped[str] = mapped_column(String(50), default="STARTER")
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    companies: Mapped[List["Company"]] = relationship("Company", back_populates="tenant", cascade="all, delete-orphan")
    config: Mapped["TenantConfig"] = relationship("TenantConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan")

class TenantConfig(Base):
    __tablename__ = "tenant_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_uuid: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), unique=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    theme_color: Mapped[str] = mapped_column(String(20), default="#4f46e5")
    modules_enabled_json: Mapped[str] = mapped_column(String, default='["PROCUREMENT","INVENTORY"]')
    inventory_costing_method: Mapped[str] = mapped_column(String(20), default="FIFO")
    allow_negative_inventory: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Configurable accounting settings
    inventory_control_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    inventory_adjustment_gain_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    inventory_adjustment_loss_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    inventory_variance_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="config")
    inventory_control_account: Mapped[Optional["Account"]] = relationship("Account", foreign_keys=[inventory_control_account_id])
    inventory_adjustment_gain_account: Mapped[Optional["Account"]] = relationship("Account", foreign_keys=[inventory_adjustment_gain_account_id])
    inventory_adjustment_loss_account: Mapped[Optional["Account"]] = relationship("Account", foreign_keys=[inventory_adjustment_loss_account_id])
    inventory_variance_account: Mapped[Optional["Account"]] = relationship("Account", foreign_keys=[inventory_variance_account_id])

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_uuid: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))
    name: Mapped[str] = mapped_column(String(100), index=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String(100))
    tax_id: Mapped[Optional[str]] = mapped_column(String(100))
    base_currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="companies")
    branches: Mapped[List["Branch"]] = relationship("Branch", back_populates="company", cascade="all, delete-orphan")

class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[Optional[str]] = mapped_column(String(100))
    is_headquarters: Mapped[bool] = mapped_column(Boolean, default=False)
    
    company: Mapped["Company"] = relationship("Company", back_populates="branches")

class BaseMaster(Base):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class ProcurementCategory(BaseMaster):
    __tablename__ = "procurement_categories"
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    prefix: Mapped[str] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(String(500))
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("procurement_categories.id"), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    color: Mapped[Optional[str]] = mapped_column(String(20))
    default_department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    default_warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    workflow_definition_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("workflow_definitions.id"), nullable=True)
    
    parent: Mapped[Optional["ProcurementCategory"]] = relationship("ProcurementCategory", remote_side="ProcurementCategory.id")
    department: Mapped[Optional["Department"]] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()
    workflow_definition: Mapped[Optional["WorkflowDefinition"]] = relationship()

class Department(BaseMaster):
    __tablename__ = "departments"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    default_cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id"), nullable=True)

class CostCenter(BaseMaster):
    __tablename__ = "cost_centers"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id"), nullable=True)

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

    @property
    def employee_code(self) -> str:
        return self.employee_id

class Customer(BaseMaster):
    __tablename__ = "customers"
    
    customer_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(100), index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), unique=True, nullable=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(10), unique=True, nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(Text)
    shipping_address: Mapped[Optional[str]] = mapped_column(Text)
    state: Mapped[Optional[str]] = mapped_column(String(50))
    country: Mapped[str] = mapped_column(String(50), default="India")
    contact_person: Mapped[Optional[str]] = mapped_column(String(100))
    contact_email: Mapped[Optional[str]] = mapped_column(String(100))
    contact_number: Mapped[Optional[str]] = mapped_column(String(20))
    credit_limit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100))
    customer_type: Mapped[str] = mapped_column(String(50), default="RETAIL")
    
    # Relationships
    quotations = relationship("SalesQuotation", back_populates="customer")
    sales_orders = relationship("SalesOrder", back_populates="customer")
    receivables = relationship("AccountsReceivable", back_populates="customer")
    ledger_entries = relationship("CustomerLedger", back_populates="customer")
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

    items: Mapped[List["Item"]] = relationship(back_populates="default_vendor", foreign_keys="[Item.default_vendor_id]")
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(back_populates="vendor")
    invoices: Mapped[List["Invoice"]] = relationship(back_populates="vendor")
    commercial_profile: Mapped[Optional["VendorCommercialProfile"]] = relationship(back_populates="vendor", uselist=False)

class CommercialTermsTemplate(Base):
    __tablename__ = "commercial_terms_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    payment_terms: Mapped[str] = mapped_column(String(200))
    freight_terms: Mapped[str] = mapped_column(String(200))
    delivery_terms: Mapped[str] = mapped_column(String(200))
    warranty_clauses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    insurance_clauses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    penalty_clauses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validity_clauses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispatch_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class VendorCommercialProfile(Base):
    __tablename__ = "vendor_commercial_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"), unique=True)
    
    account_number: Mapped[Optional[str]] = mapped_column(String(50))
    branch_name: Mapped[Optional[str]] = mapped_column(String(100))
    upi_id: Mapped[Optional[str]] = mapped_column(String(100))
    swift_code: Mapped[Optional[str]] = mapped_column(String(20))
    freight_preferences: Mapped[Optional[str]] = mapped_column(String(200))
    delivery_terms: Mapped[Optional[str]] = mapped_column(String(200))
    default_commercial_terms_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("commercial_terms_templates.id"), nullable=True)
    state_code: Mapped[Optional[str]] = mapped_column(String(10)) # For Intra/Inter-state GST
    
    vendor: Mapped["Vendor"] = relationship(back_populates="commercial_profile")
    default_terms: Mapped[Optional["CommercialTermsTemplate"]] = relationship()

class Warehouse(BaseMaster):
    __tablename__ = "warehouses"

    warehouse_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100))
    contact_number: Mapped[Optional[str]] = mapped_column(String(50))
    company_name: Mapped[Optional[str]] = mapped_column(String(100))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    landmark: Mapped[Optional[str]] = mapped_column(String(100))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pin_code: Mapped[Optional[str]] = mapped_column(String(20))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Item(BaseMaster):
    __tablename__ = "items"

    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True) # Also referred as item_code
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(String(255))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    standard_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0.0)
    default_vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"))
    preferred_vendor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    hsn_code: Mapped[Optional[str]] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(50), default="Raw Component")
    subcategory: Mapped[Optional[str]] = mapped_column(String(50))
    uom: Mapped[str] = mapped_column(String(20), default="Nos")
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18.00)
    mpn: Mapped[Optional[str]] = mapped_column(String(100))
    oem: Mapped[Optional[str]] = mapped_column(String(100))
    footprint: Mapped[Optional[str]] = mapped_column(String(50))
    bin_location: Mapped[Optional[str]] = mapped_column(String(50))
    
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=0)
    maximum_stock: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    default_vendor: Mapped[Optional["Vendor"]] = relationship(back_populates="items", foreign_keys=[default_vendor_id])
    inventory_ledger: Mapped[Optional["InventoryLedger"]] = relationship(back_populates="item", uselist=False)

class InventoryLedger(Base):
    __tablename__ = "inventory_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), unique=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=10)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item: Mapped["Item"] = relationship(back_populates="inventory_ledger")

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(50)) # RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, REVALUATION, COUNT, etc.
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    # Legacy fields kept for backward compatibility with existing codebase
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("items.id"), nullable=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    valuation_unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), default=0.0, nullable=True)

    item: Mapped[Optional["Item"]] = relationship(foreign_keys=[item_id])
    warehouse: Mapped[Optional["Warehouse"]] = relationship(foreign_keys=[warehouse_id])
    batch: Mapped[Optional["InventoryBatch"]] = relationship(foreign_keys=[batch_id])
    created_by: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by_id])
    lines: Mapped[List["InventoryTransactionLine"]] = relationship("InventoryTransactionLine", back_populates="transaction", cascade="all, delete-orphan")

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

class InventoryStock(Base):
    __tablename__ = "inventory_stock"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    reserved_stock: Mapped[int] = mapped_column(Integer, default=0)
    available_stock: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item: Mapped["Item"] = relationship()
    warehouse: Mapped["Warehouse"] = relationship()

class StockLedger(Base):
    __tablename__ = "stock_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    transaction_type: Mapped[str] = mapped_column(String(50)) # GRN_RECEIPT, ISSUE, RETURN, ADJUSTMENT, TRANSFER
    reference_type: Mapped[str] = mapped_column(String(50)) # e.g. 'GRN'
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    qty_in: Mapped[int] = mapped_column(Integer, default=0)
    qty_out: Mapped[int] = mapped_column(Integer, default=0)
    balance_after: Mapped[int] = mapped_column(Integer, default=0)
    unit_rate: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    total_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    remarks: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item: Mapped["Item"] = relationship()
    warehouse: Mapped["Warehouse"] = relationship()

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
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("procurement_categories.id"), nullable=True)
    
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
    
    cgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    igst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    freight_tax: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    commercial_terms_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("commercial_terms_templates.id"), nullable=True)
    
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
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
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
    transporter_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    invoice_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    eway_bill_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_challan_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    receipt_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, PENDING_APPROVAL, APPROVED, RECEIVED, QC_HOLD, PARTIAL, CLOSED, REJECTED
    
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    cgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    sgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    igst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    revision_number: Mapped[int] = mapped_column(Integer, default=0)
    pdf_snapshot_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
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
    previously_received_qty: Mapped[int] = mapped_column(Integer, default=0)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    accepted_qty: Mapped[int] = mapped_column(Integer, default=0)
    rejected_qty: Mapped[int] = mapped_column(Integer, default=0)
    pending_qty: Mapped[int] = mapped_column(Integer, default=0)
    
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
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

class OCRProcessingQueue(Base):
    __tablename__ = "ocr_processing_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(50), default="QUEUED") # QUEUED, EXTRACTING, MATCHING, COMPLETE, FAILED
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    raw_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    extracted_data_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_log: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # After successful extraction and PO match, link to created invoice
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("invoices.id"), nullable=True)

    uploaded_by: Mapped[Optional["User"]] = relationship()

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
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("procurement_categories.id"), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tds_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    
    cgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sgst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    igst: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    freight_tax: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    commercial_terms_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("commercial_terms_templates.id"), nullable=True)

    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    workflow_state: Mapped[Optional[str]] = mapped_column(String(100), default="DRAFT")
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # --- AI OCR Intelligence Fields ---
    confidence_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    anomaly_flags: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True) # JSON list
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="invoices")
    vendor: Mapped["Vendor"] = relationship(back_populates="invoices")
    goods_receipt_note: Mapped[Optional["GoodsReceiptNote"]] = relationship()
    commercial_terms: Mapped[Optional["CommercialTermsTemplate"]] = relationship()
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
    total_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
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

    tasks: Mapped[List["ApprovalTask"]] = relationship(back_populates="instance")
    history: Mapped[List["WorkflowHistory"]] = relationship("WorkflowHistory", back_populates="instance")

# --- Analytics & Intelligence Models ---

class VendorScorecard(Base):
    __tablename__ = "vendor_scorecards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"), unique=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    delivery_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100.0)
    quality_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100.0)
    pricing_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100.0)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100.0)
    
    anomaly_count: Mapped[int] = mapped_column(Integer, default=0)
    total_spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    recommendation_tier: Mapped[str] = mapped_column(String(50), default="PREFERRED") # PREFERRED, STANDARD, ON_WATCH, RESTRICTED
    
    vendor: Mapped["Vendor"] = relationship()

class SpendAnalytics(Base):
    __tablename__ = "spend_analytics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    granularity: Mapped[str] = mapped_column(String(20)) # DAILY, MONTHLY, QUARTERLY
    
    dimension_type: Mapped[str] = mapped_column(String(50)) # VENDOR, CATEGORY, DEPARTMENT, OVERALL
    dimension_value_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    total_spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    forecasted_spend: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    savings_realized: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    po_count: Mapped[int] = mapped_column(Integer, default=0)

class ProcurementKPI(Base):
    __tablename__ = "procurement_kpis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    avg_cycle_time_days: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0)
    approval_bottleneck_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0)
    invoice_discrepancy_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0.0)
    total_savings_ytd: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    
    ai_insights_json: Mapped[Optional[str]] = mapped_column(String, nullable=True) # Text generation insights

class OperationalRecommendation(Base):
    __tablename__ = "operational_recommendations"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str] = mapped_column(String(50)) # PROCUREMENT, INVENTORY, FINANCE, WORKFLOW
    entity_type: Mapped[str] = mapped_column(String(50)) # e.g. VENDOR, ITEM, INVOICE, WORKFLOW_INSTANCE
    entity_id: Mapped[str] = mapped_column(String(50), nullable=True)
    
    severity: Mapped[str] = mapped_column(String(20), default="INFO") # INFO, WARNING, CRITICAL, OPPORTUNITY
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(1000))
    action_payload_json: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True) # Data needed to execute the recommended action
    
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE") # ACTIVE, RESOLVED, DISMISSED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

# --- Enterprise Document Storage ---

class EnterpriseDocument(Base):
    __tablename__ = "enterprise_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type: Mapped[str] = mapped_column(String(50), index=True) # PO, INVOICE, REPORT, GRN
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True) # ID of the PO/Invoice
    
    file_name: Mapped[str] = mapped_column(String(255))
    s3_key: Mapped[str] = mapped_column(String(500), unique=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    file_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # SHA-256 for tampering verification
    
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True) # For temporary exports
    
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    
    created_by: Mapped[Optional["User"]] = relationship()

class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enterprise_documents.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(50)) # GENERATED, VIEWED, DOWNLOADED, SIGNED
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    document: Mapped["EnterpriseDocument"] = relationship()
    user: Mapped["User"] = relationship()

# --- Enterprise Integration Ecosystem ---

class IntegrationConfig(Base):
    __tablename__ = "integration_configs"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_name: Mapped[str] = mapped_column(String(50), index=True) # TALLY, SAP, ZOHO, WEBHOOK
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # Vault storage
    auth_type: Mapped[str] = mapped_column(String(50), default="BEARER") # BASIC, BEARER, API_KEY
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SyncEventLog(Base):
    __tablename__ = "sync_event_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_configs.id"))
    entity_type: Mapped[str] = mapped_column(String(50)) # INVOICE, PO, VENDOR
    entity_id: Mapped[str] = mapped_column(String(50), index=True) # Local UUID
    
    direction: Mapped[str] = mapped_column(String(10)) # OUTBOUND, INBOUND
    status: Mapped[str] = mapped_column(String(20), default="PENDING") # PENDING, SUCCESS, FAILED
    
    payload: Mapped[Optional[str]] = mapped_column(String, nullable=True) # JSON payload
    response_body: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_attempt_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    integration: Mapped["IntegrationConfig"] = relationship()

class ExternalReference(Base):
    __tablename__ = "external_references"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    integration_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("integration_configs.id"))
    
    internal_entity_type: Mapped[str] = mapped_column(String(50)) # INVOICE, PO
    internal_entity_id: Mapped[str] = mapped_column(String(50), index=True)
    
    external_entity_id: Mapped[str] = mapped_column(String(100), index=True) # e.g. Tally Voucher Number
    sync_status: Mapped[str] = mapped_column(String(20)) # SYNCED, OUT_OF_SYNC
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    integration: Mapped["IntegrationConfig"] = relationship()

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
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("procurement_categories.id"), nullable=True)
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
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("procurement_categories.id"), nullable=True)
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

class TallyLedgerMapping(Base):
    __tablename__ = "tally_ledger_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50)) # e.g. 'VENDOR', 'TAX', 'BANK'
    internal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # UUID string or specific code
    tally_ledger_name: Mapped[str] = mapped_column(String(200))
    is_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TallyReconciliationReport(Base):
    __tablename__ = "tally_reconciliation_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reconciliation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    total_erp_vouchers: Mapped[int] = mapped_column(Integer, default=0)
    total_tally_vouchers: Mapped[int] = mapped_column(Integer, default=0)
    erp_total_debit: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tally_total_debit: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    mismatch_count: Mapped[int] = mapped_column(Integer, default=0)
    mismatch_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON payload
    status: Mapped[str] = mapped_column(String(50), default="PENDING") # PENDING, MATCHED, MISMATCH
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50)) # e.g. 'VENDOR', 'ITEM', 'PO'
    filename: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(50), default="PENDING") # PENDING, VALIDATING, VALIDATED, EXECUTING, COMPLETED, FAILED, ROLLED_BACK
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    success_rows: Mapped[int] = mapped_column(Integer, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class ImportErrorLog(Base):
    __tablename__ = "import_error_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batches.id"))
    row_number: Mapped[int] = mapped_column(Integer)
    error_details: Mapped[str] = mapped_column(Text) # JSON string of errors per column
    raw_data: Mapped[str] = mapped_column(Text) # JSON string of the raw row data
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ColumnMappingTemplate(Base):
    __tablename__ = "column_mapping_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(50))
    mapping_config: Mapped[str] = mapped_column(Text) # JSON mapping from file headers to DB fields
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(50)) # e.g. PR_APPROVAL, GRN_PENDING, INVOICE_MATCH
    max_hours: Mapped[int] = mapped_column(Integer, default=24)
    escalation_level: Mapped[str] = mapped_column(String(50), default="MANAGER") # MANAGER, DIRECTOR, SYSTEM_AUTO_REJECT
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SLATimer(Base):
    __tablename__ = "sla_timers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sla_policies.id"))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True)) # ID of the PR, PO, etc.
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE") # ACTIVE, BREACHED, RESOLVED
    deadline: Mapped[datetime] = mapped_column(DateTime)
    escalation_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class EscalationLog(Base):
    __tablename__ = "escalation_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sla_timers.id"))
    escalation_action: Mapped[str] = mapped_column(String(100)) # e.g., "NOTIFIED_MANAGER", "AUTO_REJECTED"
    escalation_details: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ActivityEvent(Base):
    """
    Global operational activity stream for realtime updates.
    Tracks everything from PO approvals to SLA breaches.
    """
    __tablename__ = "activity_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))  # e.g. PURCHASE_ORDER, SYSTEM, INTEGRATION
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String(100))  # e.g. APPROVED, CREATED, BREACHED
    severity: Mapped[str] = mapped_column(String(20), default="INFO")  # INFO, WARNING, CRITICAL, SUCCESS
    actor_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # Who did it (System if None)
    description: Mapped[str] = mapped_column(String(500))
    metadata_json: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    department_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # For role-based broadcast filtering
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ApiRequestLog(Base):
    __tablename__ = "api_request_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    endpoint: Mapped[str] = mapped_column(String(255))
    method: Mapped[str] = mapped_column(String(10))
    status_code: Mapped[int] = mapped_column(Integer)
    response_time_ms: Mapped[float] = mapped_column(Float)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class QueueTaskLog(Base):
    __tablename__ = "queue_task_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[str] = mapped_column(String(255), unique=True)
    task_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50)) # SUCCESS, FAILURE, RETRY
    execution_time_ms: Mapped[float] = mapped_column(Float)
    error_traceback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SystemAlert(Base):
    __tablename__ = "system_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type: Mapped[str] = mapped_column(String(100)) # e.g. API_DEGRADATION, QUEUE_BACKLOG, SYNC_FAILURE
    severity: Mapped[str] = mapped_column(String(50)) # CRITICAL, WARNING, INFO
    message: Mapped[str] = mapped_column(Text)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ==========================================
# BUDGET GOVERNANCE & STRATEGIC SPEND MODELS
# ==========================================

class BudgetMaster(Base):
    __tablename__ = "budget_masters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    fiscal_year: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="DRAFT") # DRAFT, ACTIVE, FROZEN, CLOSED
    total_budget: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    allocations: Mapped[List["BudgetAllocation"]] = relationship("BudgetAllocation", back_populates="budget_master")

class BudgetAllocation(Base):
    __tablename__ = "budget_allocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_master_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budget_masters.id"))
    
    # Polymorphic mappings
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    cost_center_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id"), nullable=True)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("procurement_categories.id"), nullable=True)
    branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)

    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    soft_limit_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=80.00)
    hard_limit_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=100.00)
    
    escalate_to_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    budget_master: Mapped["BudgetMaster"] = relationship("BudgetMaster", back_populates="allocations")
    consumption: Mapped["BudgetConsumption"] = relationship("BudgetConsumption", back_populates="allocation", uselist=False)

class BudgetConsumption(Base):
    __tablename__ = "budget_consumptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    allocation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budget_allocations.id"), unique=True)
    
    pending_approval_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0.00) # Planned
    committed_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0.00) # PO Approved
    accrued_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0.00) # GRN received
    consumed_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0.00) # Actual (Invoice Matched)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=0.00) # Payment
    
    last_recalculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    allocation: Mapped["BudgetAllocation"] = relationship("BudgetAllocation", back_populates="consumption")

class CommitmentLedgerEntry(Base):
    __tablename__ = "commitment_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    allocation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budget_allocations.id"))
    document_type: Mapped[str] = mapped_column(String(50)) # PR, PO, GRN, INV, PMT
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    transition_type: Mapped[str] = mapped_column(String(100)) # e.g. PLANNED_TO_COMMITTED
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    allocation: Mapped["BudgetAllocation"] = relationship("BudgetAllocation")

class BudgetAdjustment(Base):
    __tablename__ = "budget_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    allocation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budget_allocations.id"))
    adjustment_amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    reason: Mapped[str] = mapped_column(Text)
    adjusted_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    allocation: Mapped["BudgetAllocation"] = relationship("BudgetAllocation")
    adjusted_by: Mapped["User"] = relationship("User")



# ==========================================
# ACCOUNTS PAYABLE & VENDOR FINANCE MODELS
# ==========================================

class TDSConfiguration(Base):
    __tablename__ = 'tds_configurations'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255))
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    threshold_limit: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class VendorLedger(Base):
    __tablename__ = 'vendor_ledger'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('vendors.id'), index=True)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    transaction_type: Mapped[str] = mapped_column(String(50)) # INVOICE, PAYMENT, ADVANCE, CREDIT_NOTE, DEBIT_NOTE, TDS, ADJUSTMENT
    reference_type: Mapped[str] = mapped_column(String(50)) # e.g. AP_VOUCHER, PAYMENT
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    running_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0) # Positive = We owe vendor (Credit balance)
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    vendor: Mapped['Vendor'] = relationship()
    created_by: Mapped[Optional['User']] = relationship()

class AccountsPayable(Base):
    __tablename__ = 'accounts_payable'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ap_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('vendors.id'), index=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('invoices.id'), nullable=True)
    po_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('purchase_orders.id'), nullable=True)
    grn_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('goods_receipt_notes.id'), nullable=True)
    
    invoice_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    tds_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    payable_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0) # (invoice + gst) - tds
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    payment_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, PARTIALLY_PAID, PAID, OVERDUE, ON_HOLD
    approval_status: Mapped[str] = mapped_column(String(50), default='PENDING_APPROVAL')
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    vendor: Mapped['Vendor'] = relationship()
    invoice: Mapped[Optional['Invoice']] = relationship()
    purchase_order: Mapped[Optional['PurchaseOrder']] = relationship()
    grn: Mapped[Optional['GoodsReceiptNote']] = relationship()

class VendorPayment(Base):
    __tablename__ = 'vendor_payments'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('vendors.id'), index=True)
    payment_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payment_method: Mapped[str] = mapped_column(String(50)) # BANK_TRANSFER, CHEQUE, CASH, RTGS, NEFT, UPI
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    account_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utr_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cheque_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    tds_deducted: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    narration: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    approval_status: Mapped[str] = mapped_column(String(50), default='APPROVED') # DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, RELEASED
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    vendor: Mapped['Vendor'] = relationship()
    created_by: Mapped[Optional['User']] = relationship()


class InvoiceMismatch(Base):
    __tablename__ = 'invoice_mismatches'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('invoices.id'))
    mismatch_type: Mapped[str] = mapped_column(String(100)) # e.g. QUANTITY, RATE, TAX
    expected_value: Mapped[str] = mapped_column(String(255))
    actual_value: Mapped[str] = mapped_column(String(255))
    variance: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    severity: Mapped[str] = mapped_column(String(50)) # LOW, MEDIUM, HIGH, CRITICAL
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    invoice: Mapped['Invoice'] = relationship()

class AuditTrail(Base):
    __tablename__ = 'audit_trail'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(50)) # CREATE, UPDATE, DELETE, APPROVE, REJECT
    old_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON string
    new_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON string
    performed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    performed_by: Mapped[Optional['User']] = relationship()



class ImportHistory(Base):
    __tablename__ = 'import_history'
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_name: Mapped[str] = mapped_column(String(100), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    successful_rows: Mapped[int] = mapped_column(Integer, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50)) # PENDING, SUCCESS, PARTIAL, FAILED
    error_report_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    uploaded_by: Mapped[Optional['User']] = relationship()



# =========================================================================
# CRM & SALES ERP MODULE
# =========================================================================

class Lead(Base):
    __tablename__ = 'leads'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(100))
    contact_person: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20))
    source: Mapped[Optional[str]] = mapped_column(String(50))
    industry: Mapped[Optional[str]] = mapped_column(String(50))
    expected_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    stage: Mapped[str] = mapped_column(String(50), default='NEW') # NEW, CONTACTED, QUALIFIED, QUOTATION, NEGOTIATION, WON, LOST
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    follow_up_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class FollowUpActivity(Base):
    __tablename__ = 'follow_up_activities'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('leads.id'))
    activity_type: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))

class SalesQuotation(Base):
    __tablename__ = 'sales_quotations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('leads.id'), nullable=True)
    quotation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    validity_date: Mapped[datetime] = mapped_column(DateTime)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    cgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    sgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    igst: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default='DRAFT') # DRAFT, SENT, APPROVED, REJECTED, CONVERTED
    approval_status: Mapped[str] = mapped_column(String(50), default='DRAFT')
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    customer = relationship('Customer', back_populates='quotations')
    line_items = relationship('SalesQuotationLineItem', back_populates='quotation', cascade='all, delete')

class SalesQuotationLineItem(Base):
    __tablename__ = 'sales_quotation_line_items'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sales_quotations.id'))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    description: Mapped[Optional[str]] = mapped_column(Text)
    qty: Mapped[float] = mapped_column(Numeric(12, 2))
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    gst_percent: Mapped[float] = mapped_column(Numeric(5, 2))
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    
    quotation = relationship('SalesQuotation', back_populates='line_items')
    item = relationship('Item')

class SalesOrder(Base):
    __tablename__ = 'sales_orders'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sales_order_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    quotation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('sales_quotations.id'), nullable=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    order_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    delivery_date: Mapped[datetime] = mapped_column(DateTime)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    dispatch_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, PARTIALLY_DISPATCHED, DISPATCHED, CLOSED
    payment_status: Mapped[str] = mapped_column(String(50), default='PENDING')
    approval_status: Mapped[str] = mapped_column(String(50), default='DRAFT')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    customer = relationship('Customer', back_populates='sales_orders')
    line_items = relationship('SalesOrderLineItem', back_populates='sales_order', cascade='all, delete')

class SalesOrderLineItem(Base):
    __tablename__ = 'sales_order_line_items'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sales_orders.id'))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    ordered_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    dispatched_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pending_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    rate: Mapped[float] = mapped_column(Numeric(12, 2))
    gst_percent: Mapped[float] = mapped_column(Numeric(5, 2))
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    
    sales_order = relationship('SalesOrder', back_populates='line_items')
    item = relationship('Item')

class DeliveryChallan(Base):
    __tablename__ = 'delivery_challans'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dc_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sales_orders.id'))
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('warehouses.id'))
    dispatch_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    transporter_name: Mapped[Optional[str]] = mapped_column(String(100))
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(50))
    driver_contact: Mapped[Optional[str]] = mapped_column(String(50))
    eway_bill_number: Mapped[Optional[str]] = mapped_column(String(50))
    dispatch_status: Mapped[str] = mapped_column(String(50), default='PENDING')
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    line_items = relationship('DeliveryChallanLineItem', back_populates='delivery_challan', cascade='all, delete')

class DeliveryChallanLineItem(Base):
    __tablename__ = 'delivery_challan_line_items'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dc_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('delivery_challans.id'))
    sales_order_line_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sales_order_line_items.id'))
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    dispatched_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    pending_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    
    delivery_challan = relationship('DeliveryChallan', back_populates='line_items')

class AccountsReceivable(Base):
    __tablename__ = 'accounts_receivable'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ar_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('invoices.id'), nullable=True) # Could be linked to general invoice table
    invoice_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    received_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    balance_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    due_date: Mapped[datetime] = mapped_column(DateTime)
    payment_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, PARTIALLY_RECEIVED, PAID, OVERDUE
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    customer = relationship('Customer', back_populates='receivables')

class CustomerLedger(Base):
    __tablename__ = 'customer_ledger'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    transaction_type: Mapped[str] = mapped_column(String(50)) # INVOICE, PAYMENT, CREDIT_NOTE
    reference_type: Mapped[str] = mapped_column(String(50))
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    debit_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    credit_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    running_balance: Mapped[float] = mapped_column(Numeric(12, 2))
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    customer = relationship('Customer', back_populates='ledger_entries')

class CustomerPayment(Base):
    __tablename__ = 'customer_payments'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customers.id'))
    payment_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payment_method: Mapped[str] = mapped_column(String(50))
    bank_reference: Mapped[Optional[str]] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(50), default='COMPLETED')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CustomerPaymentAllocation(Base):
    __tablename__ = 'customer_payment_allocations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('customer_payments.id'))
    ar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('accounts_receivable.id'))
    allocated_amount: Mapped[float] = mapped_column(Numeric(12, 2))



# =========================================================================
# MANUFACTURING & PRODUCTION MODULE
# =========================================================================

class BOM(Base):
    __tablename__ = 'boms'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bom_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    finished_good_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    version: Mapped[str] = mapped_column(String(20), default='V1.0')
    description: Mapped[Optional[str]] = mapped_column(Text)
    total_material_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    labor_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    overhead_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default='DRAFT') # DRAFT, ACTIVE, OBSOLETE
    approval_status: Mapped[str] = mapped_column(String(50), default='PENDING')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)

    finished_good_item = relationship('Item')
    line_items = relationship('BOMLineItem', back_populates='bom', cascade='all, delete')

class BOMLineItem(Base):
    __tablename__ = 'bom_line_items'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('boms.id'))
    raw_material_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    required_qty: Mapped[float] = mapped_column(Numeric(12, 4))
    wastage_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    
    bom = relationship('BOM', back_populates='line_items')
    raw_material_item = relationship('Item')

class ProductionOrder(Base):
    __tablename__ = 'production_orders'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    production_order_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('sales_orders.id'), nullable=True)
    bom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('boms.id'))
    production_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    completed_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    rejected_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    pending_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    planned_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    planned_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    production_status: Mapped[str] = mapped_column(String(50), default='PLANNED') # PLANNED, RELEASED, IN_PROGRESS, QC_PENDING, COMPLETED, CLOSED, CANCELLED
    approval_status: Mapped[str] = mapped_column(String(50), default='PENDING')
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    bom = relationship('BOM')
    work_orders = relationship('WorkOrder', back_populates='production_order', cascade='all, delete')

class Workstation(Base):
    __tablename__ = 'workstations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workstation_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    workstation_name: Mapped[str] = mapped_column(String(100))
    capacity_hours: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    shift_capacity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default='ACTIVE')
    maintenance_due: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class WorkOrder(Base):
    __tablename__ = 'work_orders'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    
    # Phase 14 Extensions
    wo_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    production_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('production_orders.id'), nullable=True)
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('items.id'), nullable=True)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4), nullable=True)
    operation_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    workstation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('workstations.id'), nullable=True)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    planned_hours: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    actual_hours: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    
    planned_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    planned_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    mrp_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('mrp_plans.id'), nullable=True)
    
    priority: Mapped[Optional[str]] = mapped_column(String(20), default='MEDIUM') # CRITICAL, HIGH, MEDIUM, LOW
    customer_priority: Mapped[Optional[str]] = mapped_column(String(20), default='MEDIUM') # HIGH, MEDIUM, LOW
    release_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    status: Mapped[str] = mapped_column(String(50), default='PLANNED') # DRAFT, PLANNED, RELEASED, MATERIAL_ALLOCATED, IN_PROGRESS, COMPLETED, QC_PENDING, CLOSED, CANCELLED
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    production_order = relationship('ProductionOrder', back_populates='work_orders')
    workstation = relationship('Workstation')
    item = relationship('Item')

class MRPPlan(Base):
    __tablename__ = 'mrp_plans'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('warehouses.id'), nullable=True)
    planning_horizon_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default='DRAFT') # DRAFT, COMPLETED, CANCELLED
    items_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    recommendations_generated: Mapped[int] = mapped_column(Integer, default=0)
    total_recommended_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0.0)
    run_duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    generated_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))

    warehouse = relationship('Warehouse')
    generated_by = relationship('User')
    recommendations = relationship('MRPRecommendation', back_populates='source_plan', cascade='all, delete-orphan')
    snapshots = relationship('MRPSnapshot', back_populates='source_plan', cascade='all, delete-orphan')

class MRPSnapshot(Base):
    __tablename__ = 'mrp_snapshots'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('mrp_plans.id'), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('warehouses.id'), index=True)
    on_hand_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    in_transit_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    open_po_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    reserved_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    forecast_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    net_available_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    source_plan = relationship('MRPPlan', back_populates='snapshots')
    item = relationship('Item')
    warehouse = relationship('Warehouse')

class DemandForecast(Base):
    __tablename__ = 'demand_forecasts'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('warehouses.id'), index=True)
    forecast_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    forecast_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4))
    forecast_method: Mapped[str] = mapped_column(String(50)) # MOVING_AVERAGE, WEIGHTED_MOVING_AVERAGE, MANUAL
    forecast_version: Mapped[str] = mapped_column(String(20), default='V1')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item = relationship('Item')
    warehouse = relationship('Warehouse')

class SafetyStockPolicy(Base):
    __tablename__ = 'safety_stock_policies'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('warehouses.id'), index=True)
    safety_stock_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    reorder_point_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    reorder_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=0.0)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item = relationship('Item')
    warehouse = relationship('Warehouse')

class MRPRecommendation(Base):
    __tablename__ = 'mrp_recommendations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'))
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('warehouses.id'), nullable=True)
    required_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    available_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    shortage_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    recommended_procurement_qty: Mapped[float] = mapped_column(Numeric(12, 2)) # Keep for compat
    recommended_order_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 4), nullable=True)
    recommendation_type: Mapped[str] = mapped_column(String(50)) # PURCHASE, TRANSFER, EXPEDITE, PRODUCTION
    required_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(20), default='MEDIUM', nullable=True)
    source_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('mrp_plans.id'), nullable=True)
    estimated_unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    estimated_total_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    purchase_requisition_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('purchase_requisitions.id'), nullable=True)
    purchase_requisition_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('purchase_requisition_lines.id'), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, APPROVED, REJECTED, CONVERTED, EXPIRED, CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Explainability & Traceability extensions
    reason_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    narrative: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_po_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('purchase_orders.id'), nullable=True)
    
    item = relationship('Item')
    warehouse = relationship('Warehouse')
    source_plan = relationship('MRPPlan', back_populates='recommendations')
    purchase_requisition = relationship('PurchaseRequisition')
    source_po = relationship('PurchaseOrder')

class QualityInspection(Base):
    __tablename__ = 'quality_inspections'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    production_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('production_orders.id'), nullable=True)
    
    # Phase 14 Extensions
    work_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('work_orders.id'), nullable=True)
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('items.id'), nullable=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('manufacturing_batches.id'), nullable=True)
    
    inspected_qty: Mapped[float] = mapped_column(Numeric(12, 2))
    accepted_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    rejected_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inspector_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    inspection_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, PASSED, FAILED, REWORK
    disposition: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # FG_RECEIPT, REWORK_INVENTORY, SCRAP_VARIANCE
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    inspection_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    production_order = relationship('ProductionOrder')
    work_order = relationship('WorkOrder')
    item = relationship('Item')
    batch = relationship('ManufacturingBatch')
    results = relationship('QualityInspectionResult', back_populates='inspection', cascade='all, delete-orphan')



# =========================================================================
# WORKFLOW AUTOMATION & TASK ENGINE MODULE
# =========================================================================


class SystemAnnouncement(Base):
    __tablename__ = 'system_announcements'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(50), default='ALL') # ALL, MANAGERS, ADMINS
    start_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Task(Base):
    __tablename__ = 'tasks'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text)
    task_type: Mapped[str] = mapped_column(String(50)) # APPROVAL, MANUAL, INVESTIGATION
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    assigned_to: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))
    assigned_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default='MEDIUM')
    task_status: Mapped[str] = mapped_column(String(50), default='OPEN') # OPEN, IN_PROGRESS, COMPLETED, HOLD, CANCELLED, OVERDUE
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class WorkflowRule(Base):
    __tablename__ = 'workflow_rules'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_name: Mapped[str] = mapped_column(String(200))
    module_name: Mapped[str] = mapped_column(String(100))
    trigger_event: Mapped[str] = mapped_column(String(100)) # e.g. ON_STOCK_CHANGE, ON_INVOICE_CREATE
    condition_json: Mapped[str] = mapped_column(Text) # JSON logic
    action_json: Mapped[str] = mapped_column(Text) # JSON action payload
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = 'activity_logs'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_type: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    description: Mapped[str] = mapped_column(Text)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class BackgroundJob(Base):
    __tablename__ = 'background_jobs'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_name: Mapped[str] = mapped_column(String(200))
    module_name: Mapped[str] = mapped_column(String(100))
    job_status: Mapped[str] = mapped_column(String(50), default='QUEUED') # QUEUED, RUNNING, SUCCESS, FAILED, RETRYING
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    payload_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



# =========================================================================
# INTERNAL HRMS & MAINTENANCE MODULE
# NOTE: Department and Employee models are defined in the Master section above.
# Shift model is new and added here.
# =========================================================================

class Shift(Base):
    __tablename__ = 'shifts'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shift_name: Mapped[str] = mapped_column(String(100))
    start_time: Mapped[str] = mapped_column(String(10)) # e.g. '09:00'
    end_time: Mapped[str] = mapped_column(String(10)) # e.g. '18:00'
    grace_period_minutes: Mapped[int] = mapped_column(Integer, default=15)
    weekly_off_days: Mapped[str] = mapped_column(String(50)) # e.g. 'Saturday,Sunday'
    is_night_shift: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Attendance(Base):
    __tablename__ = 'attendance'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    attendance_date: Mapped[datetime] = mapped_column(DateTime) # Date only usually
    punch_in: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    punch_out: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    attendance_status: Mapped[str] = mapped_column(String(50)) # PRESENT, ABSENT, HALF_DAY, LATE, WEEK_OFF, HOLIDAY, ON_LEAVE
    remarks: Mapped[Optional[str]] = mapped_column(Text)

class LeaveType(Base):
    __tablename__ = 'leave_types'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    leave_name: Mapped[str] = mapped_column(String(100))
    yearly_quota: Mapped[float] = mapped_column(Numeric(5, 2))
    carry_forward_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)

class LeaveRequest(Base):
    __tablename__ = 'leave_requests'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    leave_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('leave_types.id'))
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    total_days: Mapped[float] = mapped_column(Numeric(5, 2))
    reason: Mapped[str] = mapped_column(Text)
    approval_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, APPROVED, REJECTED, CANCELLED
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('employees.id'), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ExpenseClaim(Base):
    __tablename__ = 'expense_claims'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    expense_type: Mapped[str] = mapped_column(String(100))
    expense_date: Mapped[datetime] = mapped_column(DateTime)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    gst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    description: Mapped[str] = mapped_column(Text)
    attachment_path: Mapped[Optional[str]] = mapped_column(String(500))
    approval_status: Mapped[str] = mapped_column(String(50), default='PENDING') # PENDING, APPROVED, REJECTED, REIMBURSED
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('employees.id'), nullable=True)
    reimbursement_status: Mapped[str] = mapped_column(String(50), default='PENDING')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Asset(Base):
    __tablename__ = 'assets'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    asset_name: Mapped[str] = mapped_column(String(200))
    asset_type: Mapped[str] = mapped_column(String(100)) # IT, MACHINERY, VEHICLE
    serial_number: Mapped[Optional[str]] = mapped_column(String(100))
    purchase_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    warranty_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('departments.id'), nullable=True)
    asset_status: Mapped[str] = mapped_column(String(50), default='AVAILABLE') # AVAILABLE, ASSIGNED, UNDER_REPAIR, SCRAPPED
    current_location: Mapped[Optional[str]] = mapped_column(String(200))
    remarks: Mapped[Optional[str]] = mapped_column(Text)

class AssetAllocation(Base):
    __tablename__ = 'asset_allocations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('assets.id'))
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    allocated_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    return_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    allocation_status: Mapped[str] = mapped_column(String(50), default='ACTIVE') # ACTIVE, RETURNED
    remarks: Mapped[Optional[str]] = mapped_column(Text)

class MaintenanceRequest(Base):
    __tablename__ = 'maintenance_requests'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    machine_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('assets.id'))
    reported_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    issue_type: Mapped[str] = mapped_column(String(100))
    priority: Mapped[str] = mapped_column(String(50), default='MEDIUM')
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default='OPEN') # OPEN, IN_PROGRESS, COMPLETED, CLOSED, ESCALATED
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('employees.id'), nullable=True)
    downtime_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    downtime_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class PreventiveMaintenanceSchedule(Base):
    __tablename__ = 'preventive_maintenance_schedules'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('assets.id'))
    maintenance_type: Mapped[str] = mapped_column(String(100))
    frequency_days: Mapped[int] = mapped_column(Integer)
    next_due_date: Mapped[datetime] = mapped_column(DateTime)
    checklist_json: Mapped[Optional[str]] = mapped_column(Text)
    assigned_team: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class MaintenanceLog(Base):
    __tablename__ = 'maintenance_logs'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    maintenance_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('maintenance_requests.id'), nullable=True)
    work_done: Mapped[str] = mapped_column(Text)
    spare_parts_used: Mapped[Optional[str]] = mapped_column(Text)
    downtime_hours: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    completed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('employees.id'))
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    remarks: Mapped[Optional[str]] = mapped_column(Text)


# =========================================================================
# ENTERPRISE BI & ANALYTICS MODULE
# NOTE: AnalyticsSnapshot is already defined in the core analytics section
# above (line ~1280). BusinessInsight is new and added here.
# =========================================================================

class BusinessInsight(Base):
    __tablename__ = 'business_insights'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_name: Mapped[str] = mapped_column(String(50))
    insight_type: Mapped[str] = mapped_column(String(50)) # ANOMALY, TREND, FORECAST
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default='INFO') # INFO, WARNING, CRITICAL
    data_json: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SystemHealthMetric(Base):
    __tablename__ = 'system_health_metrics'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cpu_usage: Mapped[float] = mapped_column(Float)
    memory_usage: Mapped[float] = mapped_column(Float)
    db_status: Mapped[str] = mapped_column(String(20)) # UP, DOWN
    redis_status: Mapped[str] = mapped_column(String(20)) # UP, DOWN
    celery_queue_depth: Mapped[int] = mapped_column(Integer, default=0)
    websocket_pool_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# =========================================================================
# GENERAL LEDGER & CHART OF ACCOUNTS MODELS
# =========================================================================

class FiscalYear(Base):
    __tablename__ = "fiscal_years"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="OPEN") # OPEN, CLOSING, CLOSED
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    periods: Mapped[List["AccountingPeriod"]] = relationship("AccountingPeriod", back_populates="fiscal_year", cascade="all, delete-orphan")

class JournalSequence(Base):
    __tablename__ = "journal_sequences"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_year_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fiscal_years.id"), unique=True, index=True)
    current_number: Mapped[int] = mapped_column(Integer, default=0)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_name: Mapped[str] = mapped_column(String(50), unique=True, index=True) # e.g. "2026-06"
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="OPEN") # OPEN, CLOSED, LOCKED
    fiscal_year_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("fiscal_years.id"), nullable=True)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    fiscal_year: Mapped[Optional["FiscalYear"]] = relationship("FiscalYear", back_populates="periods")

class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    account_type: Mapped[str] = mapped_column(String(50)) # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    parent_account: Mapped[Optional["Account"]] = relationship("Account", remote_side=[id], backref="child_accounts")

class PostingConfiguration(Base):
    __tablename__ = "posting_configurations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_key: Mapped[str] = mapped_column(String(100), unique=True, index=True) # e.g. "INVENTORY_RECEIPT"
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    account: Mapped["Account"] = relationship("Account")

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    entry_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reference_type: Mapped[str] = mapped_column(String(50)) # GRN, INVOICE, PAYMENT, MANUAL
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    source_module: Mapped[str] = mapped_column(String(50)) # PROCUREMENT, FINANCE, MANUAL
    source_event: Mapped[str] = mapped_column(String(100)) # e.g. "goods_received"
    narration: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="POSTED") # DRAFT, POSTED, REVERSED
    reversal_of_journal_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("journal_entries.id"), nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    journal_lines: Mapped[List["JournalLine"]] = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")

class JournalLine(Base):
    __tablename__ = "journal_lines"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("journal_entries.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.0"))
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.0"))
    narration: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    
    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="journal_lines")
    account: Mapped["Account"] = relationship("Account")


# =========================================================================
# INVENTORY VALUATION & COST ACCOUNTING MODULE
# =========================================================================

class InventoryCostLayer(Base):
    __tablename__ = "inventory_cost_layers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    original_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    remaining_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    source_grn_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("goods_receipt_notes.id"), nullable=True)
    source_po_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True)
    layer_status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN, PARTIALLY_CONSUMED, CONSUMED
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_issue_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    item: Mapped["Item"] = relationship("Item")
    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")
    source_grn: Mapped[Optional["GoodsReceiptNote"]] = relationship("GoodsReceiptNote")
    source_po: Mapped[Optional["PurchaseOrder"]] = relationship("PurchaseOrder")


class InventoryValuationEntry(Base):
    __tablename__ = "inventory_valuation_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(50))  # RECEIPT, CONSUMPTION, TRANSFER, ADJUSTMENT
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    running_inventory_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    running_inventory_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    costing_method_used: Mapped[str] = mapped_column(String(20))  # FIFO, WAC, STANDARD
    reference_type: Mapped[str] = mapped_column(String(50))  # GRN, MATERIAL_ISSUE, STOCK_TRANSFER, ADJUSTMENT
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    item: Mapped["Item"] = relationship("Item")
    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")


class InventoryRevaluation(Base):
    __tablename__ = "inventory_revaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    old_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    new_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    quantity_affected: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    value_difference: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT, SUBMITTED, APPROVED, REJECTED
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    item: Mapped["Item"] = relationship("Item")
    approver: Mapped[Optional["User"]] = relationship("User")


class InventoryPeriod(Base):
    __tablename__ = "inventory_periods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    month: Mapped[int] = mapped_column(Integer)
    year: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN, CLOSING, CLOSED
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)


class InventoryAuditLog(Base):
    __tablename__ = "inventory_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(50))  # RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, REVALUATION
    before_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    after_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    before_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    after_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    reference_type: Mapped[str] = mapped_column(String(50))
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    item: Mapped["Item"] = relationship("Item")
    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")
    user: Mapped[Optional["User"]] = relationship("User")


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    inventory_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    inventory_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    item_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True)
    qty_change: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT, SUBMITTED, APPROVED, REJECTED
    reason_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    item: Mapped["Item"] = relationship("Item")
    warehouse: Mapped[Optional["Warehouse"]] = relationship("Warehouse")
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by])
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])


class InventoryTransactionLine(Base):
    __tablename__ = "inventory_transaction_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_transactions.id"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("warehouses.id"), nullable=True, index=True)
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("inventory_batches.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer)
    valuation_unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0.0)
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    transaction: Mapped["InventoryTransaction"] = relationship("InventoryTransaction", back_populates="lines")
    item: Mapped["Item"] = relationship()
    warehouse: Mapped[Optional["Warehouse"]] = relationship()
    batch: Mapped[Optional["InventoryBatch"]] = relationship()


class InventoryTransfer(Base):
    __tablename__ = "inventory_transfers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_number: Mapped[str] = mapped_column(String(50), unique=True)
    source_warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    destination_warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT") # DRAFT, PENDING_APPROVAL, APPROVED, IN_TRANSIT, COMPLETED, CANCELLED
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    source_warehouse: Mapped["Warehouse"] = relationship("Warehouse", foreign_keys=[source_warehouse_id])
    destination_warehouse: Mapped["Warehouse"] = relationship("Warehouse", foreign_keys=[destination_warehouse_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id])
    lines: Mapped[List["InventoryTransferLine"]] = relationship("InventoryTransferLine", back_populates="transfer", cascade="all, delete-orphan")


class InventoryTransferLine(Base):
    __tablename__ = "inventory_transfer_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_transfers.id"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    qty_requested: Mapped[int] = mapped_column(Integer)
    qty_transferred: Mapped[int] = mapped_column(Integer, default=0)
    qty_received: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0.0)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    transfer: Mapped["InventoryTransfer"] = relationship("InventoryTransfer", back_populates="lines")
    item: Mapped["Item"] = relationship()


class CycleCount(Base):
    __tablename__ = "cycle_counts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    count_number: Mapped[str] = mapped_column(String(50), unique=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT") # DRAFT, PENDING_APPROVAL, COMPLETED, CANCELLED
    count_date: Mapped[datetime] = mapped_column(DateTime)
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    counted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    warehouse: Mapped["Warehouse"] = relationship()
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    counted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[counted_by_id])
    verified_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[verified_by_id])
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id])
    lines: Mapped[List["CycleCountLine"]] = relationship("CycleCountLine", back_populates="cycle_count", cascade="all, delete-orphan")


class CycleCountLine(Base):
    __tablename__ = "cycle_count_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_count_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cycle_counts.id"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    system_qty: Mapped[int] = mapped_column(Integer)
    physical_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    variance_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0.0)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    cycle_count: Mapped["CycleCount"] = relationship("CycleCount", back_populates="lines")
    item: Mapped["Item"] = relationship()


class InventoryIssue(Base):
    __tablename__ = "inventory_issues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issue_number: Mapped[str] = mapped_column(String(50), unique=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"), index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    issue_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT") # DRAFT, SUBMITTED, APPROVED, POSTED
    issue_type: Mapped[str] = mapped_column(String(50), default="ISSUE") # ISSUE, RETURN, INTERNAL, SCRAP
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column("approved_by", ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    warehouse: Mapped["Warehouse"] = relationship("Warehouse")
    department: Mapped[Optional["Department"]] = relationship("Department")
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id])
    lines: Mapped[List["InventoryIssueLine"]] = relationship("InventoryIssueLine", back_populates="issue", cascade="all, delete-orphan")


class InventoryIssueLine(Base):
    __tablename__ = "inventory_issue_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inventory_issues.id"), index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0.0)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0.0)
    costing_method_used: Mapped[str] = mapped_column(String(20))
    issue_cost_basis: Mapped[str] = mapped_column(String(20)) # FIFO, WAC, STANDARD
    cost_layer_reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    issue: Mapped["InventoryIssue"] = relationship("InventoryIssue", back_populates="lines")
    item: Mapped["Item"] = relationship("Item")


# =========================================================================
# PHASE 14 ENTERPRISE MANUFACTURING MODELS
# =========================================================================

class BillOfMaterial(Base):
    __tablename__ = 'bill_of_materials'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bom_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    revision: Mapped[str] = mapped_column(String(20), default='V1.0')
    status: Mapped[str] = mapped_column(String(20), default='ACTIVE') # DRAFT, ACTIVE, OBSOLETE
    effective_from: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    item = relationship('Item')
    line_items = relationship('BillOfMaterialLine', back_populates='bom', cascade='all, delete-orphan')


class BillOfMaterialLine(Base):
    __tablename__ = 'bill_of_material_lines'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bom_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('bill_of_materials.id'), index=True)
    component_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    scrap_factor: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    uom: Mapped[str] = mapped_column(String(20))

    bom = relationship('BillOfMaterial', back_populates='line_items')
    component_item = relationship('Item')


class WorkCenter(Base):
    __tablename__ = 'work_centers'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    capacity_per_day: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('8.0000'))
    cost_per_hour: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    
    # Capacity Extensions
    available_hours_per_day: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('8.0000'))
    efficiency_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal('100.00'))
    utilization_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal('100.00'))
    status: Mapped[str] = mapped_column(String(20), default='ACTIVE') # ACTIVE, INACTIVE, MAINTENANCE

    calendar_events = relationship('WorkCenterCalendar', back_populates='work_center', cascade='all, delete-orphan')


class WorkCenterCalendar(Base):
    __tablename__ = 'work_center_calendars'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    event_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    event_type: Mapped[str] = mapped_column(String(50)) # HOLIDAY, MAINTENANCE, DOWNTIME
    hours_blocked: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    description: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)

    work_center = relationship('WorkCenter', back_populates='calendar_events')


class Routing(Base):
    __tablename__ = 'routings'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    revision: Mapped[str] = mapped_column(String(20), default='V1.0')
    status: Mapped[str] = mapped_column(String(20), default='ACTIVE') # DRAFT, ACTIVE, OBSOLETE

    item = relationship('Item')
    operations = relationship('RoutingOperation', back_populates='routing', cascade='all, delete-orphan')


class RoutingOperation(Base):
    __tablename__ = 'routing_operations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('routings.id'), index=True)
    sequence_no: Mapped[int] = mapped_column(Integer)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    operation_name: Mapped[str] = mapped_column(String(100))
    setup_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    run_time_minutes: Mapped[int] = mapped_column(Integer, default=0)

    routing = relationship('Routing', back_populates='operations')
    work_center = relationship('WorkCenter')


class WorkOrderMaterial(Base):
    __tablename__ = 'work_order_materials'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_orders.id'), index=True)
    component_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    quantity_required: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    quantity_issued: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    scrap_factor: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    uom: Mapped[str] = mapped_column(String(20))

    work_order = relationship('WorkOrder')
    component_item = relationship('Item')


class WorkOrderOperation(Base):
    __tablename__ = 'work_order_operations'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_orders.id'), index=True)
    sequence_no: Mapped[int] = mapped_column(Integer)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    operation_name: Mapped[str] = mapped_column(String(100))
    setup_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    run_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    actual_setup_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    actual_run_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default='PENDING') # PENDING, IN_PROGRESS, COMPLETED

    work_order = relationship('WorkOrder')
    work_center = relationship('WorkCenter')


class ManufacturingBatch(Base):
    __tablename__ = 'manufacturing_batches'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finished_good_batch_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_orders.id'), index=True)
    produced_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    scrap_qty: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    yield_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2))

    item = relationship('Item')
    work_order = relationship('WorkOrder')
    materials = relationship('ManufacturingBatchMaterial', back_populates='batch', cascade='all, delete-orphan')


class ManufacturingBatchMaterial(Base):
    __tablename__ = 'manufacturing_batch_materials'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('manufacturing_batches.id'), index=True)
    component_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('items.id'), index=True)
    source_batch_number: Mapped[str] = mapped_column(String(50))
    quantity_consumed: Mapped[Decimal] = mapped_column(Numeric(18, 4))

    batch = relationship('ManufacturingBatch', back_populates='materials')
    component_item = relationship('Item')


class QualityInspectionResult(Base):
    __tablename__ = 'quality_inspection_results'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('quality_inspections.id'), index=True)
    parameter_name: Mapped[str] = mapped_column(String(100))
    expected_value: Mapped[str] = mapped_column(String(100))
    actual_value: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20)) # PASS, FAIL

    inspection = relationship('QualityInspection', back_populates='results')


class ManufacturingAuditLog(Base):
    __tablename__ = 'manufacturing_audit_logs'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('work_orders.id'), nullable=True, index=True)
    bom_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('bill_of_materials.id'), nullable=True, index=True)
    routing_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('routings.id'), nullable=True, index=True)
    action_type: Mapped[str] = mapped_column(String(50)) # WO_CHANGE, BOM_REV, ROUTING_CHANGE, MAT_ISSUE, SCRAP_POST, QC_DECISION
    before_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    after_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    work_order = relationship('WorkOrder')
    bom = relationship('BillOfMaterial')
    routing = relationship('Routing')
    user = relationship('User')


from sqlalchemy import UniqueConstraint, Index

class WorkCenterAlternate(Base):
    __tablename__ = 'work_center_alternates'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    primary_work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    alternate_work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'))
    priority: Mapped[int] = mapped_column(Integer, default=1)

    primary_work_center = relationship('WorkCenter', foreign_keys=[primary_work_center_id])
    alternate_work_center = relationship('WorkCenter', foreign_keys=[alternate_work_center_id])


class CapacityPlan(Base):
    __tablename__ = 'capacity_plans'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    planning_start_date: Mapped[datetime] = mapped_column(DateTime)
    planning_end_date: Mapped[datetime] = mapped_column(DateTime)
    planning_horizon_days: Mapped[int] = mapped_column(Integer)
    scheduling_mode: Mapped[str] = mapped_column(String(20)) # FORWARD, BACKWARD, HYBRID
    schedule_freeze_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='DRAFT') # DRAFT, ACTIVE, ARCHIVED
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    generated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)

    generated_by = relationship('User')
    scenarios = relationship('PlanningScenario', back_populates='capacity_plan', cascade='all, delete-orphan')


class PlanningScenario(Base):
    __tablename__ = 'planning_scenarios'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    capacity_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('capacity_plans.id'), index=True)
    scenario_type: Mapped[str] = mapped_column(String(50)) # BASE_PLAN, OVERTIME, EXTRA_SHIFT, MACHINE_BREAKDOWN, CAPACITY_EXPANSION
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey('users.id'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    capacity_plan = relationship('CapacityPlan', back_populates='scenarios')
    created_by = relationship('User')


class CapacityRequirement(Base):
    __tablename__ = 'capacity_requirements'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capacity_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('capacity_plans.id'), index=True)
    work_order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_orders.id'), index=True)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    operation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_order_operations.id'), index=True)
    required_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    scheduled_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    remaining_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    available_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    utilization_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal('0.00'))
    overload_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))

    capacity_plan = relationship('CapacityPlan')
    work_order = relationship('WorkOrder')
    work_center = relationship('WorkCenter')
    operation = relationship('WorkOrderOperation')


class CapacityCalendar(Base):
    __tablename__ = 'capacity_calendars'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capacity_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('capacity_plans.id'), index=True)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'))
    date: Mapped[datetime] = mapped_column(DateTime)
    available_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    planned_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    blocked_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    efficiency_factor: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal('1.00'))

    capacity_plan = relationship('CapacityPlan')
    work_center = relationship('WorkCenter')

    __table_args__ = (
        UniqueConstraint('capacity_plan_id', 'work_center_id', 'date', name='uq_plan_wc_date'),
        Index('idx_cap_cal_wc_date', 'work_center_id', 'date'),
    )


class CapacityException(Base):
    __tablename__ = 'capacity_exceptions'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    capacity_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('capacity_plans.id'), index=True)
    work_center_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('work_centers.id'), index=True)
    exception_type: Mapped[str] = mapped_column(String(50)) # OVERLOAD, UNDERLOAD, MAINTENANCE, HOLIDAY, LATE_DELIVERY
    exception_date: Mapped[datetime] = mapped_column(DateTime)
    severity: Mapped[str] = mapped_column(String(20)) # INFO, WARNING, CRITICAL
    message: Mapped[str] = mapped_column(String(250))
    impact_hours: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal('0.0000'))
    late_days: Mapped[int] = mapped_column(Integer, default=0)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    capacity_plan = relationship('CapacityPlan')
    work_center = relationship('WorkCenter')


class APSLock(Base):
    __tablename__ = 'aps_locks'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, index=True)
    lock_acquired_at: Mapped[datetime] = mapped_column(DateTime)
    lock_expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)



