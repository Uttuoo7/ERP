import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field, EmailStr

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

class SaaSOnboardingRequest(BaseModel):
    company_name: str
    domain: str
    admin_username: str
    admin_email: EmailStr
    admin_password: str

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
class InventoryStockResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    current_stock: int
    reserved_stock: int
    available_stock: int
    last_updated: datetime
    model_config = ConfigDict(from_attributes=True)

class StockLedgerResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    transaction_type: str
    reference_type: str
    reference_id: uuid.UUID
    qty_in: int
    qty_out: int
    balance_after: int
    unit_rate: Decimal
    total_value: Decimal
    remarks: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -- Items --
class ItemBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    unit_price: Decimal = Field(decimal_places=2)
    standard_rate: Decimal = Field(default=0, decimal_places=2)
    default_vendor_id: Optional[uuid.UUID] = None
    preferred_vendor_id: Optional[uuid.UUID] = None
    hsn_code: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    uom: str
    gst_rate: Decimal = Field(decimal_places=2)
    mpn: Optional[str] = None
    oem: Optional[str] = None
    footprint: Optional[str] = None
    bin_location: Optional[str] = None
    reorder_level: int = 0
    minimum_stock: int = 0
    maximum_stock: int = 0
    is_active: bool = True

class ItemCreate(ItemBase):
    pass

class ItemUpdate(ItemBase):
    pass

class InventoryLedgerResponse(BaseModel):
    id: uuid.UUID
    quantity_on_hand: int
    quantity_reserved: int
    reorder_point: int
    
    model_config = ConfigDict(from_attributes=True)

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

# -- Procurement Categories --
class ProcurementCategoryBase(BaseModel):
    name: str
    code: str
    prefix: str
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    default_department_id: Optional[uuid.UUID] = None
    default_warehouse_id: Optional[uuid.UUID] = None
    workflow_definition_id: Optional[uuid.UUID] = None

class ProcurementCategoryCreate(ProcurementCategoryBase):
    pass

class ProcurementCategoryUpdate(ProcurementCategoryBase):
    pass

class ProcurementCategoryResponse(ProcurementCategoryBase, BaseMasterResponse):
    pass

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
    customer_code: str
    company_name: str
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_number: Optional[str] = None
    credit_limit: float = 0.0
    payment_terms: Optional[str] = None
    customer_type: str = "RETAIL"

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(CustomerBase):
    pass

class CustomerResponse(CustomerBase, BaseMasterResponse):
    pass

# -- Warehouses --
class WarehouseBase(BaseModel):
    warehouse_code: str
    name: str
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    company_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    landmark: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    is_active: bool = True

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
    hsn_code: Optional[str] = None
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
    
    cgst: Decimal = Field(default=0, decimal_places=2)
    sgst: Decimal = Field(default=0, decimal_places=2)
    igst: Decimal = Field(default=0, decimal_places=2)
    freight_tax: Decimal = Field(default=0, decimal_places=2)
    commercial_terms_id: Optional[uuid.UUID] = None
    
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
    previously_received_qty: int = 0
    quantity_received: int = 0
    accepted_qty: int = 0
    rejected_qty: int = 0
    pending_qty: int = 0
    unit_price: Decimal = Field(default=0, decimal_places=2)
    gst_percent: Decimal = Field(default=0, decimal_places=2)
    total: Decimal = Field(default=0, decimal_places=2)
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
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    invoice_reference: Optional[str] = None
    eway_bill_number: Optional[str] = None
    delivery_challan_number: Optional[str] = None
    status: str
    subtotal: Decimal = Field(default=0, decimal_places=2)
    cgst: Decimal = Field(default=0, decimal_places=2)
    sgst: Decimal = Field(default=0, decimal_places=2)
    igst: Decimal = Field(default=0, decimal_places=2)
    total_amount: Decimal = Field(default=0, decimal_places=2)
    remarks: Optional[str] = None
    revision_number: int = 0
    pdf_snapshot_path: Optional[str] = None
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
    discount_amount: Decimal = Field(default=0, decimal_places=2)
    
    cgst: Decimal = Field(default=0, decimal_places=2)
    sgst: Decimal = Field(default=0, decimal_places=2)
    igst: Decimal = Field(default=0, decimal_places=2)
    freight_tax: Decimal = Field(default=0, decimal_places=2)
    commercial_terms_id: Optional[uuid.UUID] = None
    irn_number: Optional[str] = None
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

# --- Commercial Document & Term Schemas ---
class CommercialTermsTemplateBase(BaseModel):
    name: str
    payment_terms: str
    freight_terms: str
    delivery_terms: str
    warranty_clauses: Optional[str] = None
    insurance_clauses: Optional[str] = None
    penalty_clauses: Optional[str] = None
    validity_clauses: Optional[str] = None
    dispatch_instructions: Optional[str] = None

class CommercialTermsTemplateCreate(CommercialTermsTemplateBase):
    pass

class CommercialTermsTemplateResponse(CommercialTermsTemplateBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class VendorCommercialProfileBase(BaseModel):
    vendor_id: uuid.UUID
    account_number: Optional[str] = None
    branch_name: Optional[str] = None
    upi_id: Optional[str] = None
    swift_code: Optional[str] = None
    freight_preferences: Optional[str] = None
    delivery_terms: Optional[str] = None
    default_commercial_terms_id: Optional[uuid.UUID] = None
    state_code: Optional[str] = None

class VendorCommercialProfileCreate(VendorCommercialProfileBase):
    pass

class VendorCommercialProfileResponse(VendorCommercialProfileBase):
    id: uuid.UUID
    default_terms: Optional[CommercialTermsTemplateResponse] = None
    model_config = ConfigDict(from_attributes=True)

# --- End Commercial Document Schemas ---

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
    category_id: Optional[uuid.UUID] = None
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

# ==========================================
# BUDGET GOVERNANCE SCHEMAS
# ==========================================

class BudgetConsumptionResponse(BaseModel):
    id: uuid.UUID
    pending_approval_amount: Decimal
    committed_amount: Decimal
    accrued_amount: Decimal
    consumed_amount: Decimal
    paid_amount: Decimal
    last_recalculated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BudgetAllocationBase(BaseModel):
    department_id: Optional[uuid.UUID] = None
    project_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    allocated_amount: Decimal
    soft_limit_percent: Decimal = 80.00
    hard_limit_percent: Decimal = 100.00
    escalate_to_role: Optional[str] = None

class BudgetAllocationCreate(BudgetAllocationBase):
    pass

class BudgetAllocationResponse(BudgetAllocationBase):
    id: uuid.UUID
    budget_master_id: uuid.UUID
    consumption: Optional[BudgetConsumptionResponse] = None
    model_config = ConfigDict(from_attributes=True)

class BudgetMasterBase(BaseModel):
    name: str
    fiscal_year: str
    status: str = "DRAFT"
    total_budget: Decimal

class BudgetMasterCreate(BudgetMasterBase):
    allocations: List[BudgetAllocationCreate] = []

class BudgetMasterUpdate(BaseModel):
    name: Optional[str] = None
    fiscal_year: Optional[str] = None
    status: Optional[str] = None
    total_budget: Optional[Decimal] = None

class BudgetMasterResponse(BudgetMasterBase):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    created_at: datetime
    allocations: List[BudgetAllocationResponse] = []
    model_config = ConfigDict(from_attributes=True)

class BudgetAdjustmentCreate(BaseModel):
    adjustment_amount: Decimal
    reason: str

class BudgetAdjustmentResponse(BaseModel):
    id: uuid.UUID
    allocation_id: uuid.UUID
    adjustment_amount: Decimal
    reason: str
    adjusted_by_id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Rebuild Pydantic forward references
RFQResponse.model_rebuild()
RFQComparisonMatrixResponse.model_rebuild()
RFQComparisonItem.model_rebuild()
RFQComparisonVendor.model_rebuild()

# ==========================================
# ACCOUNTS PAYABLE & VENDOR FINANCE SCHEMAS
# ==========================================

class TDSConfigurationBase(BaseModel):
    section_code: str
    description: str
    percentage: Decimal = Field(decimal_places=2)
    threshold_limit: Decimal = Field(decimal_places=2)
    is_active: bool = True

class TDSConfigurationResponse(TDSConfigurationBase):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class VendorLedgerResponse(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    transaction_date: datetime
    transaction_type: str
    reference_type: str
    reference_id: uuid.UUID
    debit_amount: Decimal
    credit_amount: Decimal
    running_balance: Decimal
    remarks: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AccountsPayableBase(BaseModel):
    ap_number: str
    vendor_id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
    po_id: Optional[uuid.UUID] = None
    grn_id: Optional[uuid.UUID] = None
    invoice_amount: Decimal
    gst_amount: Decimal
    tds_amount: Decimal
    payable_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    due_date: Optional[datetime] = None
    payment_status: str
    approval_status: str
    remarks: Optional[str] = None

class AccountsPayableResponse(AccountsPayableBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VendorPaymentBase(BaseModel):
    payment_number: str
    vendor_id: uuid.UUID
    payment_date: datetime
    payment_method: str
    bank_name: Optional[str] = None
    account_reference: Optional[str] = None
    utr_number: Optional[str] = None
    cheque_number: Optional[str] = None
    payment_amount: Decimal
    tds_deducted: Decimal
    narration: Optional[str] = None
    approval_status: str

class VendorPaymentCreate(BaseModel):
    vendor_id: uuid.UUID
    payment_method: str
    bank_name: Optional[str] = None
    account_reference: Optional[str] = None
    payment_amount: Decimal
    narration: Optional[str] = None
    allocations: List[dict] # {ap_id: uuid, amount: Decimal}

class VendorPaymentResponse(VendorPaymentBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InvoiceMismatchResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    mismatch_type: str
    expected_value: str
    actual_value: str
    variance: Decimal
    severity: str
    remarks: Optional[str] = None
    resolved: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PaymentAllocationResponse(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    accounts_payable_id: uuid.UUID
    allocated_amount: Decimal
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AuditTrailResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    performed_at: datetime
    ip_address: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)



class ImportHistoryBase(BaseModel):
    module_name: str
    file_name: str
    total_rows: int
    successful_rows: int
    failed_rows: int
    status: str
    error_report_path: Optional[str] = None

class ImportHistoryResponse(ImportHistoryBase):
    id: uuid.UUID
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)



# =========================================================================
# CRM & SALES ERP MODULE
# =========================================================================

class LeadBase(BaseModel):
    company_name: str
    contact_person: str
    email: str
    phone: str
    source: Optional[str] = None
    industry: Optional[str] = None
    expected_value: float = 0.0
    stage: str = 'NEW'
    remarks: Optional[str] = None
    follow_up_date: Optional[datetime] = None

class LeadCreate(LeadBase):
    pass

class LeadResponse(LeadBase):
    id: uuid.UUID
    lead_number: str
    assigned_to: Optional[uuid.UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class FollowUpActivityBase(BaseModel):
    lead_id: uuid.UUID
    activity_type: str
    notes: str

class FollowUpActivityResponse(FollowUpActivityBase):
    id: uuid.UUID
    created_at: datetime
    created_by: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class SalesQuotationLineItemBase(BaseModel):
    item_id: uuid.UUID
    description: Optional[str] = None
    qty: float
    unit_price: float
    gst_percent: float
    discount_percent: float = 0.0

class SalesQuotationCreate(BaseModel):
    customer_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    validity_date: datetime
    remarks: Optional[str] = None
    line_items: List[SalesQuotationLineItemBase]

class SalesOrderLineItemBase(BaseModel):
    item_id: uuid.UUID
    ordered_qty: float
    rate: float
    gst_percent: float

class SalesOrderCreate(BaseModel):
    quotation_id: Optional[uuid.UUID] = None
    customer_id: uuid.UUID
    delivery_date: datetime
    line_items: List[SalesOrderLineItemBase]

class DeliveryChallanLineItemBase(BaseModel):
    sales_order_line_item_id: uuid.UUID
    item_id: uuid.UUID
    dispatched_qty: float
    unit_price: float

class DeliveryChallanCreate(BaseModel):
    sales_order_id: uuid.UUID
    customer_id: uuid.UUID
    warehouse_id: uuid.UUID
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_contact: Optional[str] = None
    eway_bill_number: Optional[str] = None
    remarks: Optional[str] = None
    line_items: List[DeliveryChallanLineItemBase]

class AccountsReceivableResponse(BaseModel):
    id: uuid.UUID
    ar_number: str
    customer_id: uuid.UUID
    invoice_id: Optional[uuid.UUID]
    invoice_amount: float
    received_amount: float
    balance_amount: float
    due_date: datetime
    payment_status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CustomerLedgerResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    transaction_type: str
    reference_type: str
    reference_id: uuid.UUID
    debit_amount: float
    credit_amount: float
    running_balance: float
    remarks: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CustomerPaymentCreate(BaseModel):
    customer_id: uuid.UUID
    payment_method: str
    bank_reference: Optional[str] = None
    amount: float
    allocations: List[Dict[str, float]] # [{'ar_id': uuid, 'amount': float}]



# =========================================================================
# MANUFACTURING & PRODUCTION MODULE
# =========================================================================

class BOMLineItemBase(BaseModel):
    raw_material_item_id: uuid.UUID
    required_qty: float
    wastage_percent: float = 0.0

class BOMCreate(BaseModel):
    finished_good_item_id: uuid.UUID
    version: str = 'V1.0'
    description: Optional[str] = None
    labor_cost: float = 0.0
    overhead_cost: float = 0.0
    line_items: List[BOMLineItemBase]

class BOMResponse(BaseModel):
    id: uuid.UUID
    bom_number: str
    status: str
    total_cost: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ProductionOrderCreate(BaseModel):
    sales_order_id: Optional[uuid.UUID] = None
    bom_id: uuid.UUID
    production_qty: float
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    remarks: Optional[str] = None

class WorkOrderCreate(BaseModel):
    production_order_id: uuid.UUID
    operation_name: str
    workstation_id: Optional[uuid.UUID] = None
    planned_hours: float = 0.0
    remarks: Optional[str] = None

class MRPRecommendationResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: Optional[uuid.UUID] = None
    required_qty: float
    available_qty: float
    shortage_qty: float
    recommended_procurement_qty: float
    recommended_order_qty: Optional[Decimal] = None
    recommendation_type: str
    required_date: Optional[datetime] = None
    priority: Optional[str] = None
    source_plan_id: Optional[uuid.UUID] = None
    estimated_unit_cost: Optional[Decimal] = None
    estimated_total_cost: Optional[Decimal] = None
    purchase_requisition_id: Optional[uuid.UUID] = None
    purchase_requisition_line_id: Optional[uuid.UUID] = None
    status: str
    reason_code: Optional[str] = None
    narrative: Optional[str] = None
    source_po_id: Optional[uuid.UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class QualityInspectionCreate(BaseModel):
    production_order_id: uuid.UUID
    inspected_qty: float
    accepted_qty: float
    rejected_qty: float
    rejection_reason: Optional[str] = None
    remarks: Optional[str] = None



# =========================================================================
# WORKFLOW AUTOMATION & TASK ENGINE MODULE
# =========================================================================

class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str
    priority: str = 'MEDIUM'
    entity_type: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    assigned_to: uuid.UUID
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: uuid.UUID
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[uuid.UUID] = None
    assigned_to: uuid.UUID
    due_date: Optional[datetime] = None
    priority: str = 'MEDIUM'
    remarks: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: uuid.UUID
    task_number: str
    task_status: str
    assigned_by: Optional[uuid.UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class WorkflowRuleCreate(BaseModel):
    rule_name: str
    module_name: str
    trigger_event: str
    condition_json: str
    action_json: str
    is_active: bool = True

class WorkflowRuleResponse(WorkflowRuleCreate):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BackgroundJobResponse(BaseModel):
    id: uuid.UUID
    job_name: str
    module_name: str
    job_status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)



# =========================================================================
# INTERNAL HRMS & MAINTENANCE MODULE
# =========================================================================

class HREmployeeBase(BaseModel):
    employee_code: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    designation: Optional[str] = "Employee"
    employment_type: Optional[str] = "Full-time"
    status: str = 'ACTIVE'

class HREmployeeCreate(HREmployeeBase):
    pass

class HREmployeeResponse(HREmployeeBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AttendanceBase(BaseModel):
    employee_id: uuid.UUID
    attendance_date: datetime
    punch_in: Optional[datetime] = None
    punch_out: Optional[datetime] = None
    attendance_status: str

class AttendanceCreate(AttendanceBase):
    pass

class LeaveRequestBase(BaseModel):
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    start_date: datetime
    end_date: datetime
    total_days: float
    reason: str

class LeaveRequestCreate(LeaveRequestBase):
    pass

class LeaveRequestResponse(LeaveRequestBase):
    id: uuid.UUID
    approval_status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AssetBase(BaseModel):
    asset_code: str
    asset_name: str
    asset_type: str
    department_id: Optional[uuid.UUID] = None
    asset_status: str = 'AVAILABLE'

class AssetCreate(AssetBase):
    pass

class MaintenanceRequestBase(BaseModel):
    machine_asset_id: uuid.UUID
    reported_by: uuid.UUID
    issue_type: str
    priority: str = 'MEDIUM'
    description: str

class MaintenanceRequestCreate(MaintenanceRequestBase):
    pass

class MaintenanceRequestResponse(MaintenanceRequestBase):
    id: uuid.UUID
    request_number: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)



# =========================================================================
# ENTERPRISE BI & ANALYTICS MODULE
# =========================================================================

class AnalyticsSnapshotBase(BaseModel):
    snapshot_type: str
    metrics_json: str

class AnalyticsSnapshotCreate(AnalyticsSnapshotBase):
    pass

class AnalyticsSnapshotResponse(AnalyticsSnapshotBase):
    id: uuid.UUID
    snapshot_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BusinessInsightBase(BaseModel):
    module_name: str
    insight_type: str
    message: str
    severity: str = 'INFO'
    data_json: Optional[str] = None
    is_active: bool = True

class BusinessInsightCreate(BusinessInsightBase):
    pass

class BusinessInsightResponse(BusinessInsightBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SystemHealthMetricResponse(BaseModel):
    id: uuid.UUID
    cpu_usage: float
    memory_usage: float
    db_status: str
    redis_status: str
    celery_queue_depth: int
    websocket_pool_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# =========================================================================
# INVENTORY VALUATION & COST ACCOUNTING MODULE SCHEMAS
# =========================================================================

class InventorySettingsResponse(BaseModel):
    inventory_costing_method: str
    allow_negative_inventory: bool

class InventorySettingsUpdate(BaseModel):
    inventory_costing_method: str
    allow_negative_inventory: bool

class InventoryValuationItem(BaseModel):
    item_id: uuid.UUID
    sku: str
    name: str
    quantity_on_hand: float
    unit_cost: float
    inventory_value: float
    warehouse_name: Optional[str] = None
    category_name: Optional[str] = None

class InventoryValuationResponse(BaseModel):
    items: List[InventoryValuationItem]
    warehouse_totals: dict
    category_totals: dict
    company_total_value: float


class InventoryRevaluationCreate(BaseModel):
    item_id: uuid.UUID
    new_cost: Decimal = Field(decimal_places=4)
    reason: str

class InventoryRevaluationResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    old_cost: Decimal
    new_cost: Decimal
    quantity_affected: Decimal
    value_difference: Decimal
    reason: str
    status: str
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventorySnapshotCreate(BaseModel):
    snapshot_date: datetime
    warehouse_id: Optional[uuid.UUID] = None

class InventorySnapshotResponse(BaseModel):
    id: uuid.UUID
    snapshot_date: datetime
    warehouse_id: Optional[uuid.UUID] = None
    inventory_value: Decimal
    inventory_quantity: Decimal
    item_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventorySnapshotItemDetail(BaseModel):
    item_id: str
    sku: str
    name: str
    category: str
    quantity_on_hand: float
    unit_cost: float
    inventory_value: float

class InventorySnapshotDetailsResponse(BaseModel):
    snapshot: InventorySnapshotResponse
    details: List[InventorySnapshotItemDetail]

class InventoryAnalyticsResponse(BaseModel):
    turnover_ratio: float
    turnover_days: float
    slow_moving: List[dict]
    dead_stock: List[dict]
    obsolete_stock: List[dict]
    exposure: List[dict]
    trends: List[dict]


class InventoryAdjustmentCreate(BaseModel):
    item_id: uuid.UUID
    warehouse_id: Optional[uuid.UUID] = None
    qty_change: Decimal = Field(decimal_places=4)
    unit_cost: Decimal = Field(decimal_places=4)
    reason_code: Optional[str] = None
    remarks: Optional[str] = None

class InventoryAdjustmentResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: Optional[uuid.UUID] = None
    qty_change: Decimal
    unit_cost: Decimal
    status: str
    reason_code: Optional[str] = None
    remarks: Optional[str] = None
    created_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    tenant_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(from_attributes=True)

class InventoryTransferLineCreate(BaseModel):
    item_id: uuid.UUID
    qty_requested: int

class InventoryTransferCreate(BaseModel):
    source_warehouse_id: uuid.UUID
    destination_warehouse_id: uuid.UUID
    remarks: Optional[str] = None
    line_items: List[InventoryTransferLineCreate]

class InventoryTransferLineResponse(BaseModel):
    id: uuid.UUID
    transfer_id: uuid.UUID
    item_id: uuid.UUID
    qty_requested: int
    qty_transferred: int
    qty_received: int
    unit_cost: Decimal
    tenant_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(from_attributes=True)

class InventoryTransferResponse(BaseModel):
    id: uuid.UUID
    transfer_number: str
    source_warehouse_id: uuid.UUID
    destination_warehouse_id: uuid.UUID
    status: str
    remarks: Optional[str] = None
    created_by_id: uuid.UUID
    created_at: datetime
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    tenant_id: Optional[uuid.UUID] = None
    lines: List[InventoryTransferLineResponse] = []
    model_config = ConfigDict(from_attributes=True)

class CycleCountCreate(BaseModel):
    warehouse_id: uuid.UUID
    count_date: datetime
    remarks: Optional[str] = None

class CycleCountLineEntry(BaseModel):
    id: uuid.UUID
    physical_qty: int

class CycleCountLineResponse(BaseModel):
    id: uuid.UUID
    cycle_count_id: uuid.UUID
    item_id: uuid.UUID
    system_qty: int
    physical_qty: Optional[int] = None
    variance_qty: Optional[int] = None
    unit_cost: Decimal
    tenant_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(from_attributes=True)

class CycleCountResponse(BaseModel):
    id: uuid.UUID
    count_number: str
    warehouse_id: uuid.UUID
    status: str
    count_date: datetime
    remarks: Optional[str] = None
    created_by_id: uuid.UUID
    created_at: datetime
    counted_by_id: Optional[uuid.UUID] = None
    verified_by_id: Optional[uuid.UUID] = None
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    tenant_id: Optional[uuid.UUID] = None
    lines: List[CycleCountLineResponse] = []
    model_config = ConfigDict(from_attributes=True)

class MovementLedgerItem(BaseModel):
    id: str
    item_id: str
    sku: str
    item_name: str
    warehouse_id: str
    warehouse_name: str
    transaction_type: str
    quantity_change: float
    unit_cost: float
    total_value: float
    running_quantity_balance: float
    running_valuation_balance: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_at: datetime

class MovementLedgerResponse(BaseModel):
    total_count: int
    items: List[MovementLedgerItem]


class InventoryIssueLineCreate(BaseModel):
    item_id: uuid.UUID
    quantity: Decimal = Field(decimal_places=4)

class InventoryIssueCreate(BaseModel):
    warehouse_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    issue_date: datetime
    issue_type: str = "ISSUE" # ISSUE, RETURN, INTERNAL, SCRAP
    remarks: Optional[str] = None
    line_items: List[InventoryIssueLineCreate]

class InventoryIssueLineResponse(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    item_id: uuid.UUID
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    costing_method_used: str
    issue_cost_basis: str
    cost_layer_reference: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InventoryIssueResponse(BaseModel):
    id: uuid.UUID
    issue_number: str
    warehouse_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    issue_date: datetime
    status: str
    issue_type: str
    remarks: Optional[str] = None
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    tenant_id: Optional[uuid.UUID] = None
    created_at: datetime
    lines: List[InventoryIssueLineResponse] = []
    model_config = ConfigDict(from_attributes=True)# =========================================================================
# MRP & PLANNING MODULE SCHEMAS
# =========================================================================

class DemandForecastBase(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    forecast_date: datetime
    forecast_qty: Decimal
    forecast_method: str  # MOVING_AVERAGE, WEIGHTED_MOVING_AVERAGE, MANUAL
    forecast_version: str = 'V1'
    is_active: bool = True

class DemandForecastCreate(DemandForecastBase):
    pass

class DemandForecastResponse(DemandForecastBase):
    id: uuid.UUID
    created_at: datetime
    tenant_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class DemandForecastGenerateRequest(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    forecast_date: datetime
    months_lookback: int = 3
    method: str = "MOVING_AVERAGE"

class SafetyStockPolicyBase(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    safety_stock_qty: Decimal
    reorder_point_qty: Decimal
    reorder_qty: Decimal
    lead_time_days: int

class SafetyStockPolicyCreate(SafetyStockPolicyBase):
    pass

class SafetyStockPolicyResponse(SafetyStockPolicyBase):
    id: uuid.UUID
    created_at: datetime
    tenant_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class MRPSnapshotResponse(BaseModel):
    id: uuid.UUID
    source_plan_id: uuid.UUID
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    on_hand_qty: Decimal
    in_transit_qty: Decimal
    open_po_qty: Decimal
    reserved_qty: Decimal
    forecast_qty: Decimal
    net_available_qty: Decimal
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MRPPlanResponse(BaseModel):
    id: uuid.UUID
    plan_number: str
    warehouse_id: Optional[uuid.UUID] = None
    planning_horizon_days: int
    status: str
    items_analyzed: int
    recommendations_generated: int
    total_recommended_value: Decimal
    run_duration_ms: int
    generated_at: datetime
    generated_by_id: uuid.UUID
    tenant_id: uuid.UUID
    recommendations: List[MRPRecommendationResponse] = []
    snapshots: List[MRPSnapshotResponse] = []
    model_config = ConfigDict(from_attributes=True)

class MRPRunRequest(BaseModel):
    warehouse_id: Optional[uuid.UUID] = None
    planning_horizon_days: int = 30


# =========================================================================
# PHASE 14 ENTERPRISE MANUFACTURING SCHEMAS
# =========================================================================

class BillOfMaterialLineCreate(BaseModel):
    component_item_id: uuid.UUID
    quantity: Decimal
    scrap_factor: Decimal = Decimal('0.0000')
    uom: str

class BillOfMaterialCreate(BaseModel):
    item_id: uuid.UUID
    revision: str = 'V1.0'
    line_items: List[BillOfMaterialLineCreate]

class BillOfMaterialLineResponse(BaseModel):
    id: uuid.UUID
    bom_id: uuid.UUID
    component_item_id: uuid.UUID
    quantity: Decimal
    scrap_factor: Decimal
    uom: str
    model_config = ConfigDict(from_attributes=True)

class BillOfMaterialResponse(BaseModel):
    id: uuid.UUID
    bom_number: str
    item_id: uuid.UUID
    revision: str
    status: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    line_items: List[BillOfMaterialLineResponse] = []
    model_config = ConfigDict(from_attributes=True)


class WorkCenterCreate(BaseModel):
    code: str
    name: str
    capacity_per_day: Decimal = Decimal('8.0000')
    cost_per_hour: Decimal = Decimal('0.0000')
    available_hours_per_day: Decimal = Decimal('8.0000')
    efficiency_percent: Decimal = Decimal('100.00')
    utilization_percent: Decimal = Decimal('100.00')

class WorkCenterCalendarCreate(BaseModel):
    event_date: datetime
    event_type: str # HOLIDAY, MAINTENANCE, DOWNTIME
    hours_blocked: Decimal
    description: Optional[str] = None

class WorkCenterCalendarResponse(BaseModel):
    id: uuid.UUID
    work_center_id: uuid.UUID
    event_date: datetime
    event_type: str
    hours_blocked: Decimal
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class WorkCenterResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    capacity_per_day: Decimal
    cost_per_hour: Decimal
    available_hours_per_day: Decimal
    efficiency_percent: Decimal
    utilization_percent: Decimal
    status: str
    calendar_events: List[WorkCenterCalendarResponse] = []
    model_config = ConfigDict(from_attributes=True)


class RoutingOperationCreate(BaseModel):
    sequence_no: int
    work_center_id: uuid.UUID
    operation_name: str
    setup_time_minutes: int = 0
    run_time_minutes: int = 0

class RoutingCreate(BaseModel):
    item_id: uuid.UUID
    revision: str = 'V1.0'
    operations: List[RoutingOperationCreate]

class RoutingOperationResponse(BaseModel):
    id: uuid.UUID
    routing_id: uuid.UUID
    sequence_no: int
    work_center_id: uuid.UUID
    operation_name: str
    setup_time_minutes: int
    run_time_minutes: int
    model_config = ConfigDict(from_attributes=True)

class RoutingResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    revision: str
    status: str
    operations: List[RoutingOperationResponse] = []
    model_config = ConfigDict(from_attributes=True)


class WorkOrderNewCreate(BaseModel):
    item_id: uuid.UUID
    quantity: Decimal
    planned_start_date: datetime
    planned_end_date: datetime
    mrp_plan_id: Optional[uuid.UUID] = None

class WorkOrderMaterialResponse(BaseModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    component_item_id: uuid.UUID
    quantity_required: Decimal
    quantity_issued: Decimal
    scrap_factor: Decimal
    uom: str
    model_config = ConfigDict(from_attributes=True)

class WorkOrderOperationResponse(BaseModel):
    id: uuid.UUID
    work_order_id: uuid.UUID
    sequence_no: int
    work_center_id: uuid.UUID
    operation_name: str
    setup_time_minutes: int
    run_time_minutes: int
    actual_setup_time_minutes: int
    actual_run_time_minutes: int
    status: str
    model_config = ConfigDict(from_attributes=True)

class WorkOrderResponse(BaseModel):
    id: uuid.UUID
    wo_number: str
    item_id: uuid.UUID
    quantity: Decimal
    planned_start_date: datetime
    planned_end_date: datetime
    actual_start_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    status: str
    mrp_plan_id: Optional[uuid.UUID] = None
    model_config = ConfigDict(from_attributes=True)


class ManufacturingBatchMaterialCreate(BaseModel):
    component_item_id: uuid.UUID
    source_batch_number: str
    quantity_consumed: Decimal

class ManufacturingBatchCreate(BaseModel):
    finished_good_batch_number: str
    item_id: uuid.UUID
    work_order_id: uuid.UUID
    produced_qty: Decimal
    scrap_qty: Decimal = Decimal('0.0000')
    materials: List[ManufacturingBatchMaterialCreate]

class ManufacturingBatchMaterialResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    component_item_id: uuid.UUID
    source_batch_number: str
    quantity_consumed: Decimal
    model_config = ConfigDict(from_attributes=True)

class ManufacturingBatchResponse(BaseModel):
    id: uuid.UUID
    finished_good_batch_number: str
    item_id: uuid.UUID
    work_order_id: uuid.UUID
    produced_qty: Decimal
    scrap_qty: Decimal
    yield_percent: Decimal
    materials: List[ManufacturingBatchMaterialResponse] = []
    model_config = ConfigDict(from_attributes=True)


class QualityInspectionResultCreate(BaseModel):
    parameter_name: str
    expected_value: str
    actual_value: str
    status: str # PASS, FAIL

class QualityInspectionCreate(BaseModel):
    inspection_number: str
    work_order_id: uuid.UUID
    item_id: uuid.UUID
    batch_id: uuid.UUID
    inspected_qty: float
    accepted_qty: float
    rejected_qty: float
    rejection_reason: Optional[str] = None
    remarks: Optional[str] = None
    status: str = 'PENDING'
    disposition: Optional[str] = None
    results: List[QualityInspectionResultCreate] = []

class QualityInspectionResultResponse(BaseModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    parameter_name: str
    expected_value: str
    actual_value: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class QualityInspectionResponse(BaseModel):
    id: uuid.UUID
    inspection_number: str
    work_order_id: Optional[uuid.UUID] = None
    item_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None
    inspected_qty: float
    accepted_qty: float
    rejected_qty: float
    rejection_reason: Optional[str] = None
    inspector_id: Optional[uuid.UUID] = None
    inspection_status: str
    disposition: Optional[str] = None
    remarks: Optional[str] = None
    inspection_date: Optional[datetime] = None
    results: List[QualityInspectionResultResponse] = []
    model_config = ConfigDict(from_attributes=True)


# Phase 15 APS Schemas
from decimal import Decimal

class WorkCenterAlternateBase(BaseModel):
    primary_work_center_id: uuid.UUID
    alternate_work_center_id: uuid.UUID
    priority: int = 1

class WorkCenterAlternateCreate(WorkCenterAlternateBase):
    pass

class WorkCenterAlternateResponse(WorkCenterAlternateBase):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


class CapacityPlanBase(BaseModel):
    plan_number: str
    planning_start_date: datetime
    planning_end_date: datetime
    planning_horizon_days: int
    scheduling_mode: str # FORWARD, BACKWARD, HYBRID
    schedule_freeze_date: Optional[datetime] = None
    status: str = 'DRAFT'

class CapacityPlanCreate(CapacityPlanBase):
    pass

class CapacityPlanResponse(CapacityPlanBase):
    id: uuid.UUID
    generated_at: datetime
    generated_by_id: Optional[uuid.UUID] = None
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


class PlanningScenarioBase(BaseModel):
    name: str
    capacity_plan_id: uuid.UUID
    scenario_type: str # BASE_PLAN, OVERTIME, EXTRA_SHIFT, MACHINE_BREAKDOWN, CAPACITY_EXPANSION

class PlanningScenarioCreate(PlanningScenarioBase):
    pass

class PlanningScenarioResponse(PlanningScenarioBase):
    id: uuid.UUID
    created_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


class CapacityRequirementBase(BaseModel):
    capacity_plan_id: uuid.UUID
    work_order_id: uuid.UUID
    work_center_id: uuid.UUID
    operation_id: uuid.UUID
    required_hours: Decimal
    scheduled_hours: Decimal = Decimal('0.0000')
    remaining_hours: Decimal = Decimal('0.0000')
    available_hours: Decimal
    utilization_percent: Decimal = Decimal('0.00')
    overload_hours: Decimal = Decimal('0.0000')

class CapacityRequirementCreate(CapacityRequirementBase):
    pass

class CapacityRequirementResponse(CapacityRequirementBase):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


class CapacityCalendarBase(BaseModel):
    capacity_plan_id: uuid.UUID
    work_center_id: uuid.UUID
    date: datetime
    available_hours: Decimal
    overtime_hours: Decimal = Decimal('0.0000')
    planned_hours: Decimal = Decimal('0.0000')
    blocked_hours: Decimal = Decimal('0.0000')
    efficiency_factor: Decimal = Decimal('1.00')

class CapacityCalendarCreate(CapacityCalendarBase):
    pass

class CapacityCalendarResponse(CapacityCalendarBase):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


class CapacityExceptionBase(BaseModel):
    capacity_plan_id: uuid.UUID
    work_center_id: uuid.UUID
    exception_type: str
    exception_date: datetime
    severity: str
    message: str
    impact_hours: Decimal = Decimal('0.0000')
    late_days: int = 0
    resolved: bool = False
    resolved_at: Optional[datetime] = None

class CapacityExceptionCreate(CapacityExceptionBase):
    pass

class CapacityExceptionResponse(CapacityExceptionBase):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    is_deleted: bool
    model_config = ConfigDict(from_attributes=True)


