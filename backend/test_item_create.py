import sys
from pydantic import ValidationError
from schemas import ItemCreate
from decimal import Decimal

try:
    item = ItemCreate(
        name="Test",
        sku="TEST-1",
        category="Raw Component",
        uom="Nos",
        hsn_code="1234",
        gst_rate=Decimal("18.00"),
        unit_price=Decimal("10.5"),
        reorder_point=10,
        mpn="MPN-1",
    )
    print("ItemCreate validation passed!")
except ValidationError as e:
    print(f"ItemCreate validation failed: {e}")

try:
    from schemas import VendorCreate
    vendor = VendorCreate(
        name="Test Vendor",
        contact_email="test@test.com",
        gstin="22AAAAA0000A1Z5",
    )
    print("VendorCreate validation passed!")
except ValidationError as e:
    print(f"VendorCreate validation failed: {e}")
