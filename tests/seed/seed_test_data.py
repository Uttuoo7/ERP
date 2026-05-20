"""
tests/seed/seed_test_data.py
Comprehensive ERP demo seed dataset.

Creates a deterministic, realistic dataset covering:
  - Departments & Cost Centers
  - Employees
  - Vendors (with GSTIN/PAN)
  - Items (with HSN codes, GST rates)
  - Warehouses
  - Inventory Ledger entries
  - Purchase Requisitions → RFQs → Purchase Orders → GRNs → AP Invoices
  - Workflow Definitions + Approval Records
  - Stock Ledger Entries

Usage:
    # From project root
    py -m tests.seed.seed_test_data

    # Or in a pytest fixture
    from tests.seed.seed_test_data import seed_all
    seed_all(db_session)
"""
import os
import sys
import uuid
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal

# Allow running as standalone script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from backend import models
from backend.auth_utils import hash_password  # uses passlib bcrypt


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic UUID helpers (same IDs every run for predictable foreign keys)
# ─────────────────────────────────────────────────────────────────────────────
def det_uuid(namespace: str, name: str) -> uuid.UUID:
    """Generate a deterministic UUID5 from a namespace and name string."""
    return uuid.uuid5(uuid.UUID("12345678-1234-5678-1234-567812345678"), f"{namespace}:{name}")


# ─────────────────────────────────────────────────────────────────────────────
# Individual seeders
# ─────────────────────────────────────────────────────────────────────────────

def seed_departments(db: Session) -> dict:
    """Seed 5 departments. Returns {code: Department} mapping."""
    departments = [
        {"code": "PROC", "name": "Procurement"},
        {"code": "WARE", "name": "Warehouse & Logistics"},
        {"code": "FIN",  "name": "Finance & Accounts"},
        {"code": "ENG",  "name": "Engineering"},
        {"code": "IT",   "name": "Information Technology"},
    ]
    result = {}
    for d in departments:
        obj = db.query(models.Department).filter_by(code=d["code"]).first()
        if not obj:
            obj = models.Department(
                id=det_uuid("dept", d["code"]),
                code=d["code"],
                name=d["name"],
            )
            db.add(obj)
    db.flush()
    for d in departments:
        result[d["code"]] = db.query(models.Department).filter_by(code=d["code"]).first()
    return result


def seed_cost_centers(db: Session) -> dict:
    cost_centers = [
        {"code": "CC-PROC", "name": "Procurement Cost Center"},
        {"code": "CC-OPS",  "name": "Operations Cost Center"},
        {"code": "CC-IT",   "name": "IT Cost Center"},
    ]
    result = {}
    for cc in cost_centers:
        obj = db.query(models.CostCenter).filter_by(code=cc["code"]).first()
        if not obj:
            obj = models.CostCenter(
                id=det_uuid("cc", cc["code"]),
                code=cc["code"],
                name=cc["name"],
            )
            db.add(obj)
    db.flush()
    for cc in cost_centers:
        result[cc["code"]] = db.query(models.CostCenter).filter_by(code=cc["code"]).first()
    return result


def seed_users(db: Session) -> dict:
    """Seed one user per ERP role. Returns {role: User} mapping."""
    users_data = [
        {"username": "admin_user",       "email": "admin@erp-test.local",     "role": models.Role.ADMIN},
        {"username": "buyer_user",       "email": "buyer@erp-test.local",     "role": models.Role.BUYER},
        {"username": "warehouse_user",   "email": "warehouse@erp-test.local", "role": models.Role.WAREHOUSE},
        {"username": "finance_user",     "email": "finance@erp-test.local",   "role": models.Role.FINANCE},
        {"username": "proc_manager",     "email": "procmgr@erp-test.local",   "role": models.Role.PROCUREMENT_MANAGER},
        {"username": "fin_manager",      "email": "finmgr@erp-test.local",    "role": models.Role.FINANCE_MANAGER},
        {"username": "wh_manager",       "email": "whmgr@erp-test.local",     "role": models.Role.WAREHOUSE_MANAGER},
        {"username": "auditor_user",     "email": "auditor@erp-test.local",   "role": models.Role.AUDITOR},
    ]
    result = {}
    for u in users_data:
        obj = db.query(models.User).filter_by(username=u["username"]).first()
        if not obj:
            obj = models.User(
                id=det_uuid("user", u["username"]),
                username=u["username"],
                email=u["email"],
                hashed_password=hash_password("Test@1234"),
                role=u["role"],
                is_active=True,
            )
            db.add(obj)
    db.flush()
    for u in users_data:
        result[u["role"].value] = db.query(models.User).filter_by(username=u["username"]).first()
    return result


def seed_employees(db: Session, departments: dict) -> list:
    """Seed 10 employees across departments."""
    employees_data = [
        {"id": "EMP-001", "first": "Alice",  "last": "Sharma",   "email": "alice.sharma@erp-test.local",   "dept": "PROC"},
        {"id": "EMP-002", "first": "Bob",    "last": "Verma",    "email": "bob.verma@erp-test.local",      "dept": "PROC"},
        {"id": "EMP-003", "first": "Carol",  "last": "Nair",     "email": "carol.nair@erp-test.local",     "dept": "FIN"},
        {"id": "EMP-004", "first": "David",  "last": "Gupta",    "email": "david.gupta@erp-test.local",    "dept": "WARE"},
        {"id": "EMP-005", "first": "Eve",    "last": "Pillai",   "email": "eve.pillai@erp-test.local",     "dept": "ENG"},
        {"id": "EMP-006", "first": "Frank",  "last": "Reddy",    "email": "frank.reddy@erp-test.local",    "dept": "IT"},
        {"id": "EMP-007", "first": "Grace",  "last": "Patel",    "email": "grace.patel@erp-test.local",    "dept": "FIN"},
        {"id": "EMP-008", "first": "Henry",  "last": "Singh",    "email": "henry.singh@erp-test.local",    "dept": "PROC"},
        {"id": "EMP-009", "first": "Iris",   "last": "Menon",    "email": "iris.menon@erp-test.local",     "dept": "WARE"},
        {"id": "EMP-010", "first": "Jake",   "last": "Bose",     "email": "jake.bose@erp-test.local",      "dept": "ENG"},
    ]
    result = []
    for e in employees_data:
        obj = db.query(models.Employee).filter_by(employee_id=e["id"]).first()
        if not obj:
            dept = departments.get(e["dept"])
            obj = models.Employee(
                id=det_uuid("emp", e["id"]),
                employee_id=e["id"],
                first_name=e["first"],
                last_name=e["last"],
                email=e["email"],
                department_id=dept.id if dept else None,
            )
            db.add(obj)
            result.append(obj)
    db.flush()
    return result


def seed_vendors(db: Session) -> list:
    """Seed 5 vendors with GSTIN and PAN."""
    vendors_data = [
        {"name": "Alpha Electronics Pvt Ltd",   "email": "contact@alpha-elec.com",  "gstin": "27AABCA1234B1Z5", "pan": "AABCA1234B", "lead": 7},
        {"name": "Beta Supplies Co.",            "email": "sales@betasupplies.in",   "gstin": "29BBBCB2345C2Z6", "pan": "BBBCB2345C", "lead": 14},
        {"name": "Gamma Components Ltd",         "email": "info@gamma-comp.com",     "gstin": "07CCCDC3456D3Z7", "pan": "CCCDC3456D", "lead": 5},
        {"name": "Delta Industrial Works",       "email": "orders@delta-ind.in",     "gstin": "33DDDDE4567E4Z8", "pan": "DDDDE4567E", "lead": 21},
        {"name": "Epsilon Tech Solutions",       "email": "tech@epsilon.io",         "gstin": "24EEEEF5678F5Z9", "pan": "EEEEF5678F", "lead": 3},
    ]
    result = []
    for i, v in enumerate(vendors_data):
        obj = db.query(models.Vendor).filter_by(gstin=v["gstin"]).first()
        if not obj:
            obj = models.Vendor(
                id=det_uuid("vendor", v["gstin"]),
                name=v["name"],
                contact_email=v["email"],
                gstin=v["gstin"],
                pan=v["pan"],
                default_lead_time_days=v["lead"],
                is_msme=(i % 2 == 0),
            )
            db.add(obj)
            result.append(obj)
    db.flush()
    if not result:
        result = db.query(models.Vendor).filter(
            models.Vendor.gstin.in_([v["gstin"] for v in vendors_data])
        ).all()
    return result


def seed_items(db: Session, vendors: list) -> list:
    """Seed 10 items across categories."""
    items_data = [
        {"sku": "ITEM-CAP-100",  "name": "Capacitor 100µF 50V",       "price": 5.50,   "gst": 18, "hsn": "85322500", "cat": "Electronic Component", "uom": "Nos"},
        {"sku": "ITEM-RES-10K",  "name": "Resistor 10KΩ 0.25W",       "price": 1.20,   "gst": 18, "hsn": "85331000", "cat": "Electronic Component", "uom": "Nos"},
        {"sku": "ITEM-BOLT-M6",  "name": "Hex Bolt M6×30mm SS",       "price": 12.00,  "gst": 18, "hsn": "73181500", "cat": "Fastener",             "uom": "Pcs"},
        {"sku": "ITEM-PCB-A4",   "name": "PCB FR4 A4 Size",           "price": 450.00, "gst": 18, "hsn": "85340000", "cat": "PCB",                  "uom": "Nos"},
        {"sku": "ITEM-WIRE-05",  "name": "Copper Wire 0.5mm 100m",    "price": 350.00, "gst": 18, "hsn": "85442000", "cat": "Cable & Wire",         "uom": "Roll"},
        {"sku": "ITEM-PUMP-P3",  "name": "Centrifugal Pump 3HP",      "price": 8500.0, "gst": 28, "hsn": "84137000", "cat": "Machinery",            "uom": "Nos"},
        {"sku": "ITEM-OIL-15W",  "name": "Engine Oil 15W-40 1L",      "price": 320.00, "gst": 18, "hsn": "27101940", "cat": "Lubricant",            "uom": "Ltr"},
        {"sku": "ITEM-GLOVE-L",  "name": "Safety Gloves (L) Cotton",  "price": 45.00,  "gst":  5, "hsn": "62160000", "cat": "PPE",                  "uom": "Pair"},
        {"sku": "ITEM-LED-5W",   "name": "LED Bulb 5W Warm White",    "price": 85.00,  "gst": 12, "hsn": "85395000", "cat": "Lighting",             "uom": "Nos"},
        {"sku": "ITEM-FILTER-H", "name": "HVAC Filter G4 500×500mm",  "price": 1200.0, "gst": 18, "hsn": "84213900", "cat": "HVAC",                 "uom": "Nos"},
    ]
    result = []
    for i, item in enumerate(items_data):
        obj = db.query(models.Item).filter_by(sku=item["sku"]).first()
        if not obj:
            vendor = vendors[i % len(vendors)] if vendors else None
            obj = models.Item(
                id=det_uuid("item", item["sku"]),
                sku=item["sku"],
                name=item["name"],
                unit_price=Decimal(str(item["price"])),
                gst_rate=Decimal(str(item["gst"])),
                hsn_code=item["hsn"],
                category=item["cat"],
                uom=item["uom"],
                default_vendor_id=vendor.id if vendor else None,
            )
            db.add(obj)
            result.append(obj)
    db.flush()
    if not result:
        result = db.query(models.Item).filter(
            models.Item.sku.in_([i["sku"] for i in items_data])
        ).all()
    return result


def seed_warehouses(db: Session) -> list:
    """Seed 3 warehouses."""
    warehouses_data = [
        {
            "name": "Mumbai Central Warehouse",
            "contact_name": "Suresh Patil",
            "company_name": "P2P Logistics Pvt Ltd",
            "address_line1": "Plot 12, MIDC Industrial Area",
            "address_line2": "Andheri East",
            "city": "Mumbai", "state": "Maharashtra", "pin_code": "400093",
            "phone": "022-40001234",
        },
        {
            "name": "Delhi NCR Distribution Hub",
            "contact_name": "Rajiv Kumar",
            "company_name": "P2P Logistics Pvt Ltd",
            "address_line1": "Sector 65, Industrial Area",
            "address_line2": "Noida",
            "city": "Noida", "state": "Uttar Pradesh", "pin_code": "201301",
            "phone": "0120-5000001",
        },
        {
            "name": "Chennai South Depot",
            "contact_name": "Kavitha Rajan",
            "company_name": "P2P Logistics Pvt Ltd",
            "address_line1": "No. 45, GST Road",
            "address_line2": "Guindy",
            "city": "Chennai", "state": "Tamil Nadu", "pin_code": "600032",
            "phone": "044-22001234",
        },
    ]
    result = []
    for w in warehouses_data:
        obj = db.query(models.Warehouse).filter_by(name=w["name"]).first()
        if not obj:
            obj = models.Warehouse(
                id=det_uuid("warehouse", w["name"]),
                **w
            )
            db.add(obj)
            result.append(obj)
    db.flush()
    if not result:
        result = db.query(models.Warehouse).filter(
            models.Warehouse.name.in_([w["name"] for w in warehouses_data])
        ).all()
    return result


def seed_inventory_ledger(db: Session, items: list, warehouses: list) -> None:
    """Seed inventory ledger + warehouse stock with realistic quantities."""
    stock_data = [
        # (item_idx, wh_idx, on_hand, reserved, reorder)
        (0, 0, 500, 50,  100),
        (1, 0, 1000, 100, 200),
        (2, 1, 200, 20,   50),
        (3, 0, 50,  5,    10),
        (4, 2, 30,  0,    10),
        (5, 1, 5,   1,     2),
        (6, 0, 100, 10,   20),
        (7, 2, 300, 30,   50),
        (8, 0, 200, 15,   40),
        (9, 1, 80,  5,    15),
    ]

    for item_i, wh_i, on_hand, reserved, reorder in stock_data:
        if item_i >= len(items) or wh_i >= len(warehouses):
            continue
        item = items[item_i]
        warehouse = warehouses[wh_i]

        # Upsert InventoryLedger
        ledger = db.query(models.InventoryLedger).filter_by(item_id=item.id).first()
        if not ledger:
            ledger = models.InventoryLedger(
                item_id=item.id,
                quantity_on_hand=on_hand,
                quantity_reserved=reserved,
                reorder_point=reorder,
            )
            db.add(ledger)

        # Upsert WarehouseStock
        stock = db.query(models.WarehouseStock).filter_by(
            item_id=item.id, warehouse_id=warehouse.id, batch_id=None
        ).first()
        if not stock:
            stock = models.WarehouseStock(
                id=det_uuid("stock", f"{item.id}:{warehouse.id}"),
                warehouse_id=warehouse.id,
                item_id=item.id,
                quantity_on_hand=on_hand,
                quantity_reserved=reserved,
                valuation_unit_cost=item.unit_price,
            )
            db.add(stock)

    db.flush()


def seed_procurement_chain(db: Session, vendors: list, items: list,
                            warehouses: list, users: dict) -> dict:
    """
    Seed a full procurement chain:
    PR → RFQ → PO → GRN → AP Invoice

    Returns a dict with all created objects for use in tests.
    """
    from backend import models

    buyer_user = users.get("BUYER") or list(users.values())[0]
    vendor = vendors[0]
    warehouse = warehouses[0]

    # ── Purchase Requisition ──────────────────────────────────────────────────
    pr_id = det_uuid("pr", "PR-TEST-001")
    pr = db.query(models.PurchaseRequisition).filter_by(pr_number="PR-TEST-001").first()
    if not pr:
        pr = models.PurchaseRequisition(
            id=pr_id,
            pr_number="PR-TEST-001",
            requester_id=buyer_user.id,
            department_id=None,
            status="APPROVED",
            workflow_state="APPROVED",
            required_date=datetime.utcnow() + timedelta(days=30),
            justification="Quarterly stock replenishment for Q1",
        )
        db.add(pr)
        db.flush()

        # PR Line Items
        for i, item in enumerate(items[:3]):
            pr_line = models.PRLineItem(
                id=det_uuid("prline", f"PR-TEST-001-{i}"),
                pr_id=pr.id,
                item_id=item.id,
                quantity=50 + (i * 10),
                estimated_unit_price=item.unit_price,
                uom=item.uom,
            )
            db.add(pr_line)
        db.flush()

    # ── Request for Quotation ─────────────────────────────────────────────────
    rfq_id = det_uuid("rfq", "RFQ-TEST-001")
    rfq = db.query(models.RequestForQuotation).filter_by(rfq_number="RFQ-TEST-001").first()
    if not rfq:
        rfq = models.RequestForQuotation(
            id=rfq_id,
            rfq_number="RFQ-TEST-001",
            pr_id=pr.id,
            vendor_id=vendor.id,
            status="QUOTED",
            issue_date=datetime.utcnow(),
            closing_date=datetime.utcnow() + timedelta(days=7),
            created_by_id=buyer_user.id,
        )
        db.add(rfq)
        db.flush()

        for i, item in enumerate(items[:3]):
            rfq_line = models.RFQLineItem(
                id=det_uuid("rfqline", f"RFQ-TEST-001-{i}"),
                rfq_id=rfq.id,
                item_id=item.id,
                quantity=50 + (i * 10),
                unit_price=item.unit_price * Decimal("0.95"),  # 5% discount
                uom=item.uom,
            )
            db.add(rfq_line)
        db.flush()

    # ── Purchase Order ────────────────────────────────────────────────────────
    po_id = det_uuid("po", "PO-TEST-001")
    po = db.query(models.PurchaseOrder).filter_by(po_number="PO-TEST-001").first()
    total = sum(
        (items[i].unit_price * Decimal("0.95")) * (50 + i * 10)
        for i in range(3)
    )
    if not po:
        po = models.PurchaseOrder(
            id=po_id,
            po_number="PO-TEST-001",
            vendor_id=vendor.id,
            linked_rfq_id=rfq.id,
            status=models.POStatus.ISSUED,
            workflow_state="APPROVED",
            total_amount=total,
            order_date=datetime.utcnow(),
            expected_delivery_date=datetime.utcnow() + timedelta(days=21),
            warehouse_id=warehouse.id,
            ship_to_contact_name=warehouse.contact_name,
            ship_to_company_name=warehouse.company_name,
            ship_to_address_line1=warehouse.address_line1,
            ship_to_address_line2=warehouse.address_line2,
            ship_to_city=warehouse.city,
            ship_to_state=warehouse.state,
            ship_to_pin_code=warehouse.pin_code,
            ship_to_phone=warehouse.phone,
            created_by_id=buyer_user.id,
        )
        db.add(po)
        db.flush()

        for i, item in enumerate(items[:3]):
            po_line = models.POLineItem(
                id=det_uuid("poline", f"PO-TEST-001-{i}"),
                purchase_order_id=po.id,
                item_id=item.id,
                quantity=50 + (i * 10),
                unit_price=item.unit_price * Decimal("0.95"),
                total_price=(item.unit_price * Decimal("0.95")) * (50 + i * 10),
                uom=item.uom,
                quantity_received=0,
            )
            db.add(po_line)
        db.flush()

    # ── Goods Receipt Note ────────────────────────────────────────────────────
    grn_id = det_uuid("grn", "GRN-TEST-001")
    grn = db.query(models.GoodsReceiptNote).filter_by(grn_number="GRN-TEST-001").first()
    if not grn:
        grn = models.GoodsReceiptNote(
            id=grn_id,
            grn_number="GRN-TEST-001",
            purchase_order_id=po.id,
            vendor_id=vendor.id,
            warehouse_id=warehouse.id,
            status="COMPLETED",
            receipt_date=datetime.utcnow(),
            received_by_id=buyer_user.id,
        )
        db.add(grn)
        db.flush()

        for i, item in enumerate(items[:3]):
            qty = 50 + (i * 10)
            grn_line = models.GRNLineItem(
                id=det_uuid("grnline", f"GRN-TEST-001-{i}"),
                grn_id=grn.id,
                item_id=item.id,
                po_line_id=det_uuid("poline", f"PO-TEST-001-{i}"),
                quantity_ordered=qty,
                quantity_received=qty,
                quantity_accepted=qty,
                quantity_rejected=0,
                unit_price=item.unit_price * Decimal("0.95"),
            )
            db.add(grn_line)
        db.flush()

    # ── AP Invoice ────────────────────────────────────────────────────────────
    inv_id = det_uuid("invoice", "INV-TEST-001")
    invoice = db.query(models.Invoice).filter_by(invoice_number="INV-TEST-001").first()
    if not invoice:
        invoice = models.Invoice(
            id=inv_id,
            invoice_number="INV-TEST-001",
            vendor_id=vendor.id,
            purchase_order_id=po.id,
            grn_id=grn.id,
            status=models.InvoiceStatus.MATCHED,
            invoice_date=datetime.utcnow(),
            due_date=datetime.utcnow() + timedelta(days=30),
            total_amount=total,
            tax_amount=total * Decimal("0.18"),
            created_by_id=buyer_user.id,
        )
        db.add(invoice)
        db.flush()

    db.flush()
    return {
        "pr": pr,
        "rfq": rfq,
        "po": po,
        "grn": grn,
        "invoice": invoice,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Master seeder
# ─────────────────────────────────────────────────────────────────────────────

def seed_all(db: Session) -> dict:
    """
    Run all seeders in dependency order.
    Returns a dict containing all seeded objects for use in tests.
    """
    print("🌱 Seeding departments...")
    departments = seed_departments(db)

    print("🌱 Seeding cost centers...")
    cost_centers = seed_cost_centers(db)

    print("🌱 Seeding users...")
    users = seed_users(db)

    print("🌱 Seeding employees...")
    employees = seed_employees(db, departments)

    print("🌱 Seeding vendors...")
    vendors = seed_vendors(db)

    print("🌱 Seeding items...")
    items = seed_items(db, vendors)

    print("🌱 Seeding warehouses...")
    warehouses = seed_warehouses(db)

    print("🌱 Seeding inventory ledger + warehouse stock...")
    seed_inventory_ledger(db, items, warehouses)

    print("🌱 Seeding procurement chain (PR→RFQ→PO→GRN→Invoice)...")
    chain = seed_procurement_chain(db, vendors, items, warehouses, users)

    db.commit()
    print("✅ Seed data committed successfully.")

    return {
        "departments": departments,
        "cost_centers": cost_centers,
        "users": users,
        "employees": employees,
        "vendors": vendors,
        "items": items,
        "warehouses": warehouses,
        "chain": chain,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Standalone runner
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env.test"))

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from backend.models import Base

    DB_URL = os.getenv("TEST_DATABASE_URL",
        "postgresql://erp_test_user:erp_test_password@localhost:5433/p2p_erp_test")

    engine = create_engine(DB_URL)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        seed_all(session)

    print("🎉 Database seeding complete!")
