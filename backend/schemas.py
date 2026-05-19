import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field

# -- Shared Enums --
from .models import POStatus, InvoiceStatus, Role

# -- Auth Tokens --
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: Role

class TokenRefresh(BaseModel):
    refresh_token: str

class LoginRequest(BaseModel):
    email: str
    password: str

# -- Users --
class UserBase(BaseModel):
    username: str
    email: str
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role: Role = Role.BUYER

class UserResponse(UserBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Inventory Ledger --
class InventoryLedgerBase(BaseModel):
    quantity_on_hand: int
    quantity_reserved: int
    reorder_point: int

class InventoryLedgerResponse(InventoryLedgerBase):
    item_id: uuid.UUID
    last_updated: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Items --
class ItemBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    unit_price: Decimal = Field(decimal_places=2)
    default_vendor_id: Optional[uuid.UUID] = None
    reorder_point: int = 0
    hsn_code: Optional[str] = None
    category: str
    uom: str
    gst_rate: Decimal = Field(decimal_places=2)
    mpn: Optional[str] = None
    oem: Optional[str] = None
    footprint: Optional[str] = None
    bin_location: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    pass

class ItemResponse(ItemBase):
    id: uuid.UUID
    created_at: datetime
    inventory_ledger: Optional[InventoryLedgerResponse] = None
    model_config = ConfigDict(from_attributes=True)

# -- Vendors --
class VendorBase(BaseModel):
    name: str
    contact_email: str
    contact_phone: Optional[str] = None
    default_lead_time_days: int = 0
    gstin: Optional[str] = Field(None, pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    pan: Optional[str] = None
    is_msme: bool = False
    ifsc_code: Optional[str] = None
    is_active: bool = True

class VendorCreate(VendorBase):
    pass

class VendorUpdate(VendorBase):
    pass

class VendorResponse(VendorBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Warehouses --
class WarehouseBase(BaseModel):
    name: str
    contact_name: str
    company_name: str
    address_line1: str
    address_line2: str
    landmark: Optional[str] = None
    city: str
    state: str
    pin_code: str
    phone: str
    gstin: Optional[str] = None

class WarehouseResponse(WarehouseBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Purchase Orders --
class POLineItemBase(BaseModel):
    item_id: uuid.UUID
    quantity_ordered: int
    unit_price: Decimal = Field(decimal_places=2)
    description: Optional[str] = None

class POLineItemCreate(POLineItemBase):
    pass

class POLineItemResponse(POLineItemBase):
    id: uuid.UUID
    po_id: uuid.UUID
    quantity_received: int
    quantity_billed: int
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderBase(BaseModel):
    po_number: Optional[str] = None
    vendor_id: Optional[uuid.UUID] = None
    source_so_id: Optional[uuid.UUID] = None
    expected_delivery_date: Optional[datetime] = None
    total_amount: Decimal = Field(default=0, decimal_places=2)
    delivery_type: str = "Warehouse"
    warehouse_id: Optional[uuid.UUID] = None
    ship_to_contact_name: str
    ship_to_company_name: Optional[str] = None
    ship_to_address_line1: str
    ship_to_address_line2: str
    ship_to_landmark: Optional[str] = None
    ship_to_city: str
    ship_to_state: str
    ship_to_pin_code: str
    ship_to_phone: str

class PurchaseOrderCreate(PurchaseOrderBase):
    line_items: List[POLineItemCreate]

class PurchaseOrderUpdate(PurchaseOrderBase):
    line_items: List[POLineItemCreate]

class PurchaseOrderResponse(PurchaseOrderBase):
    id: uuid.UUID
    status: POStatus
    order_date: datetime
    line_items: List[POLineItemResponse]
    model_config = ConfigDict(from_attributes=True)

# -- Goods Receipt Notes --
class GRNLineItemBase(BaseModel):
    po_line_item_id: uuid.UUID
    quantity_received: int
    is_quality_approved: bool = True

class GRNLineItemCreate(GRNLineItemBase):
    pass

class GRNLineItemResponse(GRNLineItemBase):
    id: uuid.UUID
    grn_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class GoodsReceiptNoteBase(BaseModel):
    grn_number: str
    po_id: uuid.UUID
    received_by_id: Optional[uuid.UUID] = None

class ReceivedItem(BaseModel):
    item_id: uuid.UUID
    quantity_accepted: int
    quantity_rejected: int

class GoodsReceiptNoteCreate(BaseModel):
    po_id: uuid.UUID
    received_items: List[ReceivedItem]

class GoodsReceiptNoteResponse(GoodsReceiptNoteBase):
    id: uuid.UUID
    receipt_date: datetime
    line_items: List[GRNLineItemResponse]
    model_config = ConfigDict(from_attributes=True)

# -- Invoices --
class BilledItem(BaseModel):
    item_id: uuid.UUID
    quantity_billed: int
    unit_price: Decimal = Field(decimal_places=2)

class InvoiceLineItemBase(BaseModel):
    po_line_item_id: uuid.UUID
    quantity_billed: int
    unit_price: Decimal = Field(decimal_places=2)

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemResponse(InvoiceLineItemBase):
    id: uuid.UUID
    invoice_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class InvoiceBase(BaseModel):
    po_id: uuid.UUID
    vendor_id: uuid.UUID
    invoice_number: str
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_amount: Decimal = Field(decimal_places=2)
    gst_amount: Decimal = Field(default=0, decimal_places=2)
    tds_deducted: Decimal = Field(default=0, decimal_places=2)

class InvoiceCreateRequest(BaseModel):
    po_id: uuid.UUID
    invoice_number: str
    billed_items: List[BilledItem]
    gst_amount: Decimal = Field(default=0, decimal_places=2)
    tds_deducted: Decimal = Field(default=0, decimal_places=2)

class InvoiceCreate(InvoiceBase):
    line_items: List[InvoiceLineItemCreate]

class InvoiceResponse(InvoiceBase):
    id: uuid.UUID
    status: InvoiceStatus
    invoice_date: datetime
    line_items: List[InvoiceLineItemResponse]
    model_config = ConfigDict(from_attributes=True)

# -- Internal Sales Orders --
class SOLineItemBase(BaseModel):
    item_id: uuid.UUID
    quantity: int
    notes: Optional[str] = None

class SOLineItemCreate(SOLineItemBase):
    pass

class SOLineItemResponse(SOLineItemBase):
    id: uuid.UUID
    so_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class InternalSalesOrderBase(BaseModel):
    so_number: Optional[str] = None
    delivery_type: str = "Warehouse"
    warehouse_id: Optional[uuid.UUID] = None
    ship_to_contact_name: str
    ship_to_company_name: Optional[str] = None
    ship_to_address_line1: str
    ship_to_address_line2: str
    ship_to_landmark: Optional[str] = None
    ship_to_city: str
    ship_to_state: str
    ship_to_pin_code: str
    ship_to_phone: str

class InternalSalesOrderCreate(InternalSalesOrderBase):
    line_items: List[SOLineItemCreate]

class InternalSalesOrderUpdate(InternalSalesOrderBase):
    line_items: List[SOLineItemCreate]

class InternalSalesOrderResponse(InternalSalesOrderBase):
    id: uuid.UUID
    requester_id: Optional[uuid.UUID] = None
    status: str
    created_at: datetime
    line_items: List[SOLineItemResponse]
    model_config = ConfigDict(from_attributes=True)

# -- Attachments --
class AttachmentBase(BaseModel):
    file_name: str
    file_type: str
    source_type: str
    po_id: Optional[uuid.UUID] = None
    so_id: Optional[uuid.UUID] = None

class AttachmentResponse(AttachmentBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Analytics --
class AnalyticsOverview(BaseModel):
    total_spend: Decimal
    total_purchase_orders: int
    pending_purchase_orders: int
    approved_purchase_orders: int

class VendorPerformance(BaseModel):
    vendor_name: str
    total_spend: Decimal
    total_orders: int
    average_order_value: Decimal

class MonthlyTrend(BaseModel):
    month: str
    total_spend: Decimal
    total_orders: int

class TopItem(BaseModel):
    item_name: str
    total_quantity_purchased: int
    total_spend: Decimal

class POStatusCount(BaseModel):
    status: str
    count: int

class AnalyticsResponse(BaseModel):
    data: List[Any]
    meta: Optional[dict] = None
