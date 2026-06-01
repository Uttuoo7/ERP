import io
import csv
import logging
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple

from . import models, validation_engine

logger = logging.getLogger(__name__)

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    logger.warning("pandas is not installed. Fallback CSV parser will be used.")

def parse_upload_file(file_bytes: bytes, file_name: str) -> List[Dict[str, Any]]:
    """Parses Excel or CSV into a list of dictionaries."""
    if file_name.endswith('.csv'):
        # Parse CSV
        text = file_bytes.decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)
    elif file_name.endswith(('.xls', '.xlsx')) and PANDAS_AVAILABLE:
        # We assume the user is filling the 'Data Entry' sheet or the first sheet
        df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None)
        # Try to find 'Data Entry' sheet, else use first sheet
        sheet_to_use = 'Data Entry' if 'Data Entry' in df else list(df.keys())[0]
        # Drop rows where all elements are NaN
        data_df = df[sheet_to_use].dropna(how='all')
        # Fill NaN with empty string
        data_df = data_df.fillna('')
        return data_df.to_dict('records')
    else:
        # Fallback if no pandas but excel, which will fail. Just try text.
        text = file_bytes.decode('utf-8', errors='ignore')
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)

def preview_import(db: Session, module: str, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
    rows = parse_upload_file(file_bytes, file_name)
    
    preview_data = []
    valid_count = 0
    invalid_count = 0
    
    # Load existing state to check duplicates in memory
    if module == "vendors":
        existing_gstins = {v.gstin for v in db.query(models.Vendor).all() if v.gstin}
        validator = lambda r: validation_engine.validate_vendor_row(r, existing_gstins)
    elif module == "items":
        existing_skus = {i.sku for i in db.query(models.Item).all() if i.sku}
        validator = lambda r: validation_engine.validate_item_row(r, existing_skus)
    else:
        validator = lambda r: (True, "")
        
    for i, row in enumerate(rows, 2): # Start from 2 accounting for header
        is_valid, error_msg = validator(row)
        
        preview_data.append({
            "row_index": i,
            "data": row,
            "is_valid": is_valid,
            "error_msg": error_msg
        })
        
        if is_valid: valid_count += 1
        else: invalid_count += 1
            
    return {
        "total_rows": len(rows),
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "preview_data": preview_data # might want to limit to top 100 for very large files
    }

def commit_import(db: Session, module: str, validated_data: List[Dict[str, Any]], user_id) -> models.ImportHistory:
    """
    Commits valid rows to the database and logs an ImportHistory.
    """
    successful = 0
    failed = 0
    
    for row_data in validated_data:
        if not row_data.get("is_valid"):
            failed += 1
            continue
            
        row = row_data.get("data", {})
        try:
            if module == "vendors":
                vendor = models.Vendor(
                    vendor_code=f"V-{uuid.uuid4().hex[:6].upper()}",
                    name=row.get('Vendor Name'),
                    gstin=row.get('GSTIN'),
                    pan=row.get('PAN'),
                    state=row.get('State')
                )
                db.add(vendor)
            elif module == "items":
                item = models.Item(
                    sku=row.get('SKU'),
                    name=row.get('Name'),
                    unit_price=float(row.get('Unit Price', 0)),
                    description=row.get('Description')
                )
                db.add(item)
            successful += 1
        except Exception as e:
            logger.error(f"Failed to commit row {row_data.get('row_index')}: {e}")
            failed += 1
            
    db.commit()
    
    # Generate history
    import_history = models.ImportHistory(
        module_name=module,
        file_name=f"{module}_import_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx",
        total_rows=len(validated_data),
        successful_rows=successful,
        failed_rows=failed,
        status="SUCCESS" if failed == 0 else "PARTIAL" if successful > 0 else "FAILED",
        uploaded_by_id=user_id
    )
    db.add(import_history)
    db.commit()
    
    return import_history

import uuid
from datetime import datetime
