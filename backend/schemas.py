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


class BaseMasterResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[uuid.UUID] = None
    updated_by_id: Optional[uuid.UUID] = None
    is_active: bool
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)

# -- Departments --
class DepartmentBase(BaseModel):
    code: str
    name: str
    manager_id: Optional[uuid.UUID] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase, BaseMasterResponse):
    pass

# -- Cost Centers --
class CostCenterBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

class CostCenterCreate(CostCenterBase):
    pass

class CostCenterUpdate(CostCenterBase):
    pass

class CostCenterResponse(CostCenterBase, BaseMasterResponse):
    pass

# -- Projects --
class ProjectBase(BaseModel):
    code: str
    name: str
    cost_center_id: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    pass

class ProjectResponse(ProjectBase, BaseMasterResponse):
    pass

# -- Employees --
class EmployeeBase(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(EmployeeBase):
    pass

class EmployeeResponse(EmployeeBase, BaseMasterResponse):
    pass

# -- Customers --
class CustomerBase(BaseModel):
    customer_number: str
    name: str
    email: str
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(CustomerBase):
    pass

class CustomerResponse(CustomerBase, BaseMasterResponse):
    pass

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
    rfq_line_id: Optional[uuid.UUID] = None
    taxes: Optional[Decimal] = Field(default=0.0, decimal_places=2)
    discounts: Optional[Decimal] = Field(default=0.0, decimal_places=2)
    delivery_date: Optional[datetime] = None
    remaining_quantity: Optional[Decimal] = Field(default=0.0, decimal_places=4)
    description: Optional[str] = None

class POLineItemCreate(POLineItemBase):
    pass

class POLineItemResponse(POLineItemBase):
    id: uuid.UUID
    po_id: uuid.UUID
    quantity_received: int
    quantity_billed: int
    item: Optional[ItemResponse] = None
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderBase(BaseModel):
    po_number: Optional[str] = None
    vendor_id: Optional[uuid.UUID] = None
    source_so_id: Optional[uuid.UUID] = None
    linked_rfq_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None
    
    workflow_state: Optional[str] = "PENDING"
    amendment_version: Optional[int] = 0
    expected_delivery_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    
    tax_summary: Optional[str] = "0.0"
    discount_summary: Optional[str] = "0.0"
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

class POAmendmentResponse(BaseModel):
    id: uuid.UUID
    po_id: uuid.UUID
    amendment_number: int
    change_reason: str
    snapshot_data: str
    created_at: datetime
    created_by_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderResponse(PurchaseOrderBase):
    id: uuid.UUID
    status: POStatus
    order_date: datetime
    line_items: List[POLineItemResponse]
    created_by: Optional[UserResponse] = None
    updated_by: Optional[UserResponse] = None
    updated_at: Optional[datetime] = None
    vendor: Optional[VendorResponse] = None
    department: Optional[DepartmentResponse] = None
    project: Optional[ProjectResponse] = None
    cost_center: Optional[CostCenterResponse] = None
    amendments: Optional[List[POAmendmentResponse]] = []
    model_config = ConfigDict(from_attributes=True)

# -- Goods Receipt Notes --
class GRNLineItemBase(BaseModel):
    po_line_item_id: uuid.UUID
    item_id: uuid.UUID
    quantity_ordered: int
    quantity_received: int
    quantity_accepted: int = 0
    quantity_rejected: int = 0
    quantity_damaged: int = 0
    remaining_quantity: Decimal = 0.0
    batch_number: Optional[str] = None
    serial_numbers: Optional[str] = None
    expiry_date: Optional[datetime] = None
    warehouse_location: Optional[str] = None
    inspection_remarks: Optional[str] = None

class GRNLineItemCreate(BaseModel):
    po_line_item_id: uuid.UUID
    item_id: uuid.UUID
    quantity_received: int
    batch_number: Optional[str] = None
    serial_numbers: Optional[List[str]] = []
    expiry_date: Optional[datetime] = None
    warehouse_location: Optional[str] = None

class GRNLineItemResponse(GRNLineItemBase):
    id: uuid.UUID
    grn_id: uuid.UUID
    item: Optional[ItemResponse] = None
    model_config = ConfigDict(from_attributes=True)

class GoodsReceiptNoteBase(BaseModel):
    grn_number: str
    po_id: uuid.UUID
    vendor_id: Optional[uuid.UUID] = None
    warehouse_id: Optional[uuid.UUID] = None
    received_by_id: Optional[uuid.UUID] = None
    vehicle_details: Optional[str] = None
    delivery_challan_number: str
    status: str
    workflow_state: str
    remarks: Optional[str] = None
    inspected_by_id: Optional[uuid.UUID] = None
    inspection_date: Optional[datetime] = None
    inspection_remarks: Optional[str] = None

class GoodsReceiptNoteCreate(BaseModel):
    po_id: uuid.UUID
    warehouse_id: uuid.UUID
    delivery_challan_number: str
    vehicle_details: Optional[str] = None
    remarks: Optional[str] = None
    received_items: List[GRNLineItemCreate]

class GoodsReceiptNoteResponse(GoodsReceiptNoteBase):
    id: uuid.UUID
    receipt_date: datetime
    line_items: List[GRNLineItemResponse]
    received_by: Optional[UserResponse] = None
    inspected_by: Optional[UserResponse] = None
    vendor: Optional[VendorResponse] = None
    warehouse: Optional[WarehouseResponse] = None
    purchase_order: Optional[PurchaseOrderResponse] = None
    model_config = ConfigDict(from_attributes=True)

class GRNQCItem(BaseModel):
    line_item_id: uuid.UUID
    quantity_accepted: int
    quantity_rejected: int
    quantity_damaged: int
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    serial_numbers: Optional[List[str]] = []
    warehouse_location: Optional[str] = None
    remarks: Optional[str] = None

class GRNQCInspect(BaseModel):
    qc_items: List[GRNQCItem]
    remarks: Optional[str] = None

# -- Invoices --
class BilledItem(BaseModel):
    po_line_item_id: uuid.UUID
    grn_line_item_id: Optional[uuid.UUID] = None
    quantity_billed: int
    unit_price: Decimal = Field(decimal_places=2)
    tax_amount: Decimal = Field(default=0, decimal_places=2)
    discount_amount: Decimal = Field(default=0, decimal_places=2)

class InvoiceLineItemBase(BaseModel):
    po_line_item_id: uuid.UUID
    grn_line_item_id: Optional[uuid.UUID] = None
    quantity_billed: int
    unit_price: Decimal = Field(decimal_places=2)
    tax_amount: Decimal = Field(default=0, decimal_places=2)
    discount_amount: Decimal = Field(default=0, decimal_places=2)
    variance_amount: Decimal = Field(default=0, decimal_places=2)
    match_status: str = "PENDING_MATCHING"

class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass

class InvoiceLineItemResponse(InvoiceLineItemBase):
    id: uuid.UUID
    invoice_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class InvoiceBase(BaseModel):
    po_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_id: Optional[uuid.UUID] = None
    invoice_number: str
    vendor_invoice_number: Optional[str] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_amount: Decimal = Field(decimal_places=2)
    gst_amount: Decimal = Field(default=0, decimal_places=2)
    tds_deducted: Decimal = Field(default=0, decimal_places=2)
    discount_amount: Decimal = Field(default=0, decimal_places=2)
    workflow_state: Optional[str] = "DRAFT"
    remarks: Optional[str] = None

class InvoiceCreateRequest(BaseModel):
    po_id: uuid.UUID
    grn_id: Optional[uuid.UUID] = None
    invoice_number: str
    vendor_invoice_number: Optional[str] = None
    billed_items: List[BilledItem]
    gst_amount: Decimal = Field(default=0, decimal_places=2)
    tds_deducted: Decimal = Field(default=0, decimal_places=2)
    discount_amount: Decimal = Field(default=0, decimal_places=2)
    remarks: Optional[str] = None

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
    requester: Optional[UserResponse] = None
    updated_by: Optional[UserResponse] = None
    updated_at: Optional[datetime] = None
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

# -- Workflow Schemas --

class WorkflowStepBase(BaseModel):
    step_number: int
    name: str
    role_required: str
    condition_expression: Optional[str] = None
    escalation_timeout_hours: Optional[int] = None

class WorkflowStepCreate(WorkflowStepBase):
    pass

class WorkflowStepResponse(WorkflowStepBase):
    id: uuid.UUID
    workflow_definition_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class WorkflowDefinitionBase(BaseModel):
    module: str
    name: str
    is_active: bool = True

class WorkflowDefinitionCreate(WorkflowDefinitionBase):
    steps: List[WorkflowStepCreate]

class WorkflowDefinitionResponse(WorkflowDefinitionBase):
    id: uuid.UUID
    created_at: datetime
    steps: List[WorkflowStepResponse]
    model_config = ConfigDict(from_attributes=True)

class ApprovalTaskAction(BaseModel):
    action: str # APPROVED or REJECTED
    comments: Optional[str] = None

class ApprovalTaskResponse(BaseModel):
    id: uuid.UUID
    workflow_instance_id: uuid.UUID
    step_id: uuid.UUID
    assigned_role: str
    assigned_user_id: Optional[uuid.UUID] = None
    status: str
    comments: Optional[str] = None
    actioned_at: Optional[datetime] = None
    actioned_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    step: WorkflowStepResponse
    model_config = ConfigDict(from_attributes=True)

class WorkflowHistoryResponse(BaseModel):
    id: uuid.UUID
    workflow_instance_id: uuid.UUID
    transition_from: str
    transition_to: str
    actioned_by_id: Optional[uuid.UUID] = None
    comments: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkflowInstanceResponse(BaseModel):
    id: uuid.UUID
    workflow_definition_id: uuid.UUID
    entity_id: uuid.UUID
    current_step_number: int
    status: str
    created_at: datetime
    updated_at: datetime
    tasks: List[ApprovalTaskResponse]
    history: List[WorkflowHistoryResponse]
    model_config = ConfigDict(from_attributes=True)

# -- Purchase Requisitions (PR) Schemas --

class PurchaseRequisitionLineBase(BaseModel):
    item_id: uuid.UUID
    description: Optional[str] = None
    quantity: int
    uom: str
    estimated_price: Decimal = Field(decimal_places=2)
    suggested_vendor_id: Optional[uuid.UUID] = None
    required_date: Optional[datetime] = None
    remarks: Optional[str] = None
    budget_code: Optional[str] = None
    tax_category: Optional[str] = None

class PurchaseRequisitionLineCreate(PurchaseRequisitionLineBase):
    pass

class PurchaseRequisitionLineResponse(PurchaseRequisitionLineBase):
    id: uuid.UUID
    pr_id: uuid.UUID
    item: Optional[Any] = None
    suggested_vendor: Optional[Any] = None
    model_config = ConfigDict(from_attributes=True)

class PurchaseRequisitionCommentCreate(BaseModel):
    comment: str

class PurchaseRequisitionCommentResponse(BaseModel):
    id: uuid.UUID
    pr_id: uuid.UUID
    user_id: uuid.UUID
    comment: str
    created_at: datetime
    user: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)

class PurchaseRequisitionAuditResponse(BaseModel):
    id: uuid.UUID
    pr_id: uuid.UUID
    user_id: uuid.UUID
    action: str
    details: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)

class PurchaseRequisitionBase(BaseModel):
    department_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None
    priority: str = "MEDIUM"
    required_date: datetime
    delivery_location_id: Optional[uuid.UUID] = None
    currency: str = "INR"
    remarks: Optional[str] = None

class PurchaseRequisitionCreate(PurchaseRequisitionBase):
    line_items: List[PurchaseRequisitionLineCreate]

class PurchaseRequisitionResponse(PurchaseRequisitionBase):
    id: uuid.UUID
    pr_number: str
    requester_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime
    requester: UserResponse
    department: Optional[DepartmentResponse] = None
    project: Optional[ProjectResponse] = None
    cost_center: Optional[CostCenterResponse] = None
    delivery_location: Optional[WarehouseResponse] = None
    line_items: List[PurchaseRequisitionLineResponse]
    comments: List[PurchaseRequisitionCommentResponse] = []
    audits: List[PurchaseRequisitionAuditResponse] = []
    model_config = ConfigDict(from_attributes=True)

# -- Document Traceability & Relationship Schemas --

class DocumentLineRelationshipResponse(BaseModel):
    id: uuid.UUID
    document_relationship_id: uuid.UUID
    source_line_id: uuid.UUID
    target_line_id: uuid.UUID
    quantity_converted: Decimal = Field(decimal_places=4)
    conversion_status: str
    created_at: datetime
    created_by_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class DocumentRelationshipResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    source_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    relationship_type: str
    created_at: datetime
    created_by_id: uuid.UUID
    created_by: UserResponse
    line_links: List[DocumentLineRelationshipResponse] = []
    model_config = ConfigDict(from_attributes=True)

class DocumentLineageNode(BaseModel):
    id: uuid.UUID
    pr_number: Optional[str] = None
    po_number: Optional[str] = None
    document_number: str # Universal display label
    document_type: str # e.g. PURCHASE_REQUISITION, PURCHASE_ORDER
    status: str
    created_at: datetime
    creator_name: str
    estimated_amount: float = 0.0

class DocumentLineageGraphResponse(BaseModel):
    source_node: DocumentLineageNode
    parents: List[DocumentRelationshipResponse] = []
    children: List[DocumentRelationshipResponse] = []

# -- Request For Quotation (RFQ) Schemas --

class RFQLineCreate(BaseModel):
    pr_line_id: Optional[uuid.UUID] = None
    item_id: uuid.UUID
    quantity: Decimal
    uom: str = "Units"
    required_date: Optional[datetime] = None
    estimated_budget: Decimal = 0.0
    technical_specifications: Optional[str] = None
    vendor_notes: Optional[str] = None

class RFQCreate(BaseModel):
    due_date: datetime
    currency: str = "INR"
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    remarks: Optional[str] = None
    line_items: List[RFQLineCreate]

class RFQLineResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    pr_line_id: Optional[uuid.UUID] = None
    item_id: uuid.UUID
    quantity: Decimal
    uom: str
    required_date: Optional[datetime] = None
    estimated_budget: Decimal
    technical_specifications: Optional[str] = None
    vendor_notes: Optional[str] = None
    item: ItemResponse
    model_config = ConfigDict(from_attributes=True)

class RFQVendorInvitationResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    vendor_id: uuid.UUID
    invitation_status: str
    invited_date: datetime
    response_deadline: Optional[datetime] = None
    vendor: VendorResponse
    model_config = ConfigDict(from_attributes=True)

class VendorQuotationLineCreate(BaseModel):
    rfq_line_id: uuid.UUID
    unit_price: Decimal
    tax_rate: Decimal = 0.0
    discount_rate: Decimal = 0.0
    lead_time_days: int = 7
    vendor_remarks: Optional[str] = None

class VendorQuotationCreate(BaseModel):
    quotation_number: str
    taxes: Decimal = 0.0
    discounts: Decimal = 0.0
    lead_time_days: int = 7
    delivery_commitment: Optional[str] = None
    payment_terms: Optional[str] = None
    validity_date: datetime
    remarks: Optional[str] = None
    line_items: List[VendorQuotationLineCreate]

class VendorQuotationLineResponse(BaseModel):
    id: uuid.UUID
    vendor_quotation_id: uuid.UUID
    rfq_line_id: uuid.UUID
    unit_price: Decimal
    tax_rate: Decimal
    discount_rate: Decimal
    lead_time_days: int
    vendor_remarks: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class VendorQuotationResponse(BaseModel):
    id: uuid.UUID
    rfq_id: uuid.UUID
    vendor_id: uuid.UUID
    quotation_number: str
    total_quoted_price: Decimal
    taxes: Decimal
    discounts: Decimal
    lead_time_days: int
    delivery_commitment: Optional[str] = None
    payment_terms: Optional[str] = None
    validity_date: datetime
    remarks: Optional[str] = None
    is_selected: bool
    created_at: datetime
    created_by_id: uuid.UUID
    vendor: VendorResponse
    line_items: List[VendorQuotationLineResponse] = []
    model_config = ConfigDict(from_attributes=True)

class RFQResponse(BaseModel):
    id: uuid.UUID
    rfq_number: str
    buyer_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    due_date: datetime
    currency: str
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    status: str
    workflow_state: str
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by_id: uuid.UUID
    buyer: UserResponse
    department: Optional[DepartmentResponse] = None
    line_items: List[RFQLineResponse] = []
    invitations: List[RFQVendorInvitationResponse] = []
    quotations: List[VendorQuotationResponse] = []
    model_config = ConfigDict(from_attributes=True)

class RFQComparisonItem(BaseModel):
    rfq_line_id: uuid.UUID
    item_sku: str
    item_name: str
    required_qty: float
    vendor_prices: dict[str, float] # vendor_id -> unit_price

class RFQComparisonVendor(BaseModel):
    vendor_id: uuid.UUID
    vendor_name: str
    total_price: float
    avg_lead_time: float
    vendor_rating: float
    payment_terms: str
    weighted_score: float
    is_best_price: bool
    is_fastest: bool
    is_recommended: bool

class RFQComparisonMatrixResponse(BaseModel):
    rfq_id: uuid.UUID
    rfq_number: str
    items: List[RFQComparisonItem]
    vendors: List[RFQComparisonVendor]
    recommendation_details: str

# -- Inventory Engine Schemas --
class InventoryBatchResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    batch_number: str
    expiry_date: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventorySerialResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    serial_number: str
    status: str
    warehouse_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(from_attributes=True)

class WarehouseStockResponse(BaseModel):
    id: uuid.UUID
    warehouse_id: uuid.UUID
    item_id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    quantity_on_hand: int
    quantity_reserved: int
    quantity_damaged: int
    quantity_transit: int
    valuation_unit_cost: Decimal
    item: Optional[ItemResponse] = None
    warehouse: Optional[WarehouseResponse] = None
    batch: Optional[InventoryBatchResponse] = None
    model_config = ConfigDict(from_attributes=True)

class StockLedgerEntryResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    batch_id: Optional[uuid.UUID] = None
    transaction_type: str
    quantity_change: int
    resulting_on_hand: int
    valuation_unit_cost: Decimal
    reference_type: str
    reference_id: Optional[uuid.UUID] = None
    remarks: Optional[str] = None
    created_at: datetime
    created_by_id: Optional[uuid.UUID] = None
    item: Optional[ItemResponse] = None
    warehouse: Optional[WarehouseResponse] = None
    batch: Optional[InventoryBatchResponse] = None
    model_config = ConfigDict(from_attributes=True)

class StockAdjustmentCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    qty_change: int
    valuation_unit_cost: Decimal = Field(default=0.0, decimal_places=2)
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    serial_numbers: Optional[List[str]] = []
    remarks: Optional[str] = None

# --- Universal Financial Layer Schemas ---
class LedgerEntryResponse(BaseModel):
    id: uuid.UUID
    financial_transaction_id: uuid.UUID
    account_name: str
    debit_amount: Decimal
    credit_amount: Decimal
    narration: Optional[str] = None
    is_posted: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaxEntryResponse(BaseModel):
    id: uuid.UUID
    financial_transaction_id: uuid.UUID
    tax_type: str
    taxable_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    tax_ledger_name: str
    model_config = ConfigDict(from_attributes=True)

class FinancialTransactionResponse(BaseModel):
    id: uuid.UUID
    transaction_number: str
    transaction_type: str
    transaction_date: datetime
    reference_type: str
    reference_id: uuid.UUID
    total_amount: Decimal
    currency: str
    status: str
    department_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None
    vendor_id: Optional[uuid.UUID] = None
    warehouse_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    
    department: Optional[DepartmentResponse] = None
    project: Optional[ProjectResponse] = None
    cost_center: Optional[CostCenterResponse] = None
    vendor: Optional[VendorResponse] = None
    warehouse: Optional[WarehouseResponse] = None
    ledger_entries: List[LedgerEntryResponse] = []
    tax_entries: List[TaxEntryResponse] = []
    model_config = ConfigDict(from_attributes=True)

class VendorLiabilityResponse(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    invoice_id: uuid.UUID
    original_amount: Decimal
    outstanding_amount: Decimal
    due_date: datetime
    status: str
    created_at: datetime
    last_payment_date: Optional[datetime] = None
    
    vendor: Optional[VendorResponse] = None
    invoice: Optional[InvoiceLineItemResponse] = None # can use a general dict/any or custom invoice summary response
    model_config = ConfigDict(from_attributes=True)

class PaymentAllocationResponse(BaseModel):
    id: uuid.UUID
    financial_transaction_id: uuid.UUID
    vendor_liability_id: uuid.UUID
    allocated_amount: Decimal
    allocation_date: datetime
    model_config = ConfigDict(from_attributes=True)

class TallySyncQueueResponse(BaseModel):
    id: uuid.UUID
    financial_transaction_id: uuid.UUID
    sync_status: str
    retry_count: int
    error_message: Optional[str] = None
    payload_xml: str
    last_attempt_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    financial_transaction: Optional[FinancialTransactionResponse] = None
    model_config = ConfigDict(from_attributes=True)

class InvoiceAllocationCreate(BaseModel):
    vendor_liability_id: uuid.UUID
    allocated_amount: Decimal

class VendorPaymentCreate(BaseModel):
    vendor_id: uuid.UUID
    amount: Decimal
    payment_method: str # Bank Transfer, Cash, Cheque, UPI
    reference_number: str
    invoice_allocations: List[InvoiceAllocationCreate]

class LiabilityAgingSummary(BaseModel):
    vendor_id: uuid.UUID
    vendor_name: str
    total_outstanding: Decimal
    current_bucket: Decimal # 0-30 days
    bucket_30_60: Decimal   # 31-60 days
    bucket_60_90: Decimal   # 61-90 days
    bucket_over_90: Decimal # 91+ days

class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: str
    is_read: bool
    priority: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UserRoleAssignmentRequest(BaseModel):
    user_id: uuid.UUID
    role: str

class AuditSecurityLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    action: str
    details: str
    ip_address: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

# Rebuild Pydantic forward references
RFQResponse.model_rebuild()
RFQComparisonMatrixResponse.model_rebuild()
RFQComparisonItem.model_rebuild()
RFQComparisonVendor.model_rebuild()
