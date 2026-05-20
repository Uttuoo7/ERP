import asyncio
from backend.database import SessionLocal
from backend.models import PurchaseOrder, POLineItem, User, Vendor
from backend.schemas import PurchaseOrderCreate, POLineItemCreate
import uuid
import datetime
from decimal import Decimal

def test_po():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No user found.")
            return
            
        vendor = db.query(Vendor).first()
        if not vendor:
            print("No vendor found.")
            return

        po_schema = PurchaseOrderCreate(
            vendor_id=vendor.id,
            ship_to_contact_name="Test",
            ship_to_address_line1="123 Test St",
            ship_to_address_line2="Apt 4",
            ship_to_city="Test City",
            ship_to_state="Test State",
            ship_to_pin_code="12345",
            ship_to_phone="1234567890",
            line_items=[]
        )
        
        po_data = po_schema.model_dump(exclude={"line_items", "total_amount", "po_number"})
        
        db_po = PurchaseOrder(
            **po_data,
            po_number="PO-TEST",
            total_amount=Decimal('0.00'),
            status="DRAFT",
            created_by_id=user.id,
            updated_by_id=user.id
        )
        db.add(db_po)
        db.flush()
        db.commit()
        print("PO Created successfully:", db_po.id)
    except Exception as e:
        print("Error occurred:")
        print(repr(e))
    finally:
        db.close()

if __name__ == "__main__":
    test_po()
