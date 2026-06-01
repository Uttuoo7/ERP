import re
from typing import List, Dict, Any, Tuple

# Simple regex patterns
GSTIN_PATTERN = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
PAN_PATTERN = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'

def validate_gstin(gstin: str) -> bool:
    if not gstin: return False
    return bool(re.match(GSTIN_PATTERN, gstin.upper()))

def validate_pan(pan: str) -> bool:
    if not pan: return False
    return bool(re.match(PAN_PATTERN, pan.upper()))

def validate_vendor_row(row: Dict[str, Any], existing_gstins: set) -> Tuple[bool, str]:
    """Validates a single vendor import row."""
    errors = []
    
    # 1. Required fields
    if not row.get('Vendor Name'):
        errors.append("Vendor Name is required")
        
    gstin = str(row.get('GSTIN', '')).strip()
    if gstin:
        if not validate_gstin(gstin):
            errors.append("Invalid GSTIN Format")
        elif gstin in existing_gstins:
            errors.append("Duplicate GSTIN found in database or current file")
        existing_gstins.add(gstin)
        
    pan = str(row.get('PAN', '')).strip()
    if pan and not validate_pan(pan):
        errors.append("Invalid PAN Format")
        
    if errors:
        return False, " | ".join(errors)
    return True, ""

def validate_item_row(row: Dict[str, Any], existing_skus: set) -> Tuple[bool, str]:
    errors = []
    
    sku = str(row.get('SKU', '')).strip()
    if not sku:
        errors.append("SKU is required")
    elif sku in existing_skus:
        errors.append("Duplicate SKU found in database or current file")
    existing_skus.add(sku)
    
    if not row.get('Name'):
        errors.append("Item Name is required")
        
    try:
        price = float(row.get('Unit Price', 0))
        if price < 0:
            errors.append("Unit Price cannot be negative")
    except ValueError:
        errors.append("Unit Price must be a number")
        
    if errors:
        return False, " | ".join(errors)
    return True, ""
