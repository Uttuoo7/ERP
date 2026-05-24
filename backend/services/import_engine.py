import pandas as pd
import json
import logging
from typing import Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from .. import models

logger = logging.getLogger(__name__)

def parse_file_headers(file_path: str) -> List[str]:
    """Reads a CSV or XLSX and returns the list of columns."""
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=0)
        elif file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path, nrows=0)
        else:
            raise ValueError("Unsupported file format")
        return df.columns.tolist()
    except Exception as e:
        logger.error(f"Error parsing headers from {file_path}: {e}")
        raise

def validate_batch(db: Session, batch: models.ImportBatch, file_path: str, mapping: Dict[str, str]) -> Tuple[bool, List[Dict]]:
    """
    Validates the data against constraints without committing.
    mapping is a dict: { "File Column Header" : "ERP Field Name" }
    """
    batch.status = "VALIDATING"
    db.commit()
    
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        errors = []
        # Basic validation
        for index, row in df.iterrows():
            row_errors = {}
            for file_col, erp_field in mapping.items():
                val = row.get(file_col)
                if pd.isna(val):
                    continue
                # Specific validation logic based on entity_type and erp_field
                if batch.entity_type == "VENDOR":
                    if erp_field == "gstin" and len(str(val)) != 15:
                        row_errors[file_col] = "Invalid GSTIN format (must be 15 chars)"
                elif batch.entity_type == "ITEM":
                    if erp_field == "unit_price" and float(val) < 0:
                        row_errors[file_col] = "Unit price cannot be negative"
            
            if row_errors:
                errors.append({
                    "row_number": index + 1, # 1-indexed for users
                    "error_details": json.dumps(row_errors),
                    "raw_data": json.dumps(row.to_dict())
                })
        
        batch.total_rows = len(df)
        if errors:
            batch.status = "FAILED"
        else:
            batch.status = "VALIDATED"
            
        db.commit()
        return (len(errors) == 0, errors)
        
    except Exception as e:
        batch.status = "FAILED"
        db.commit()
        logger.error(f"Validation failed: {e}")
        raise

def execute_import(db: Session, batch: models.ImportBatch, file_path: str, mapping: Dict[str, str]) -> bool:
    """
    Executes the import within a nested transaction. Rolls back entirely if any row fails.
    """
    batch.status = "EXECUTING"
    db.commit()
    
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        # Start a nested transaction for safety
        nested = db.begin_nested()
        
        success_count = 0
        failed_count = 0
        
        for index, row in df.iterrows():
            try:
                # Map row data to kwargs
                kwargs = {}
                for file_col, erp_field in mapping.items():
                    val = row.get(file_col)
                    if pd.notna(val):
                        kwargs[erp_field] = val
                        
                # Create entity
                if batch.entity_type == "VENDOR":
                    entity = models.Vendor(**kwargs)
                elif batch.entity_type == "ITEM":
                    entity = models.Item(**kwargs)
                else:
                    raise ValueError(f"Unsupported entity type: {batch.entity_type}")
                    
                db.add(entity)
                success_count += 1
                
            except Exception as e:
                failed_count += 1
                error_log = models.ImportErrorLog(
                    batch_id=batch.id,
                    row_number=index + 1,
                    error_details=json.dumps({"import_error": str(e)}),
                    raw_data=json.dumps(row.to_dict())
                )
                db.add(error_log)

        if failed_count > 0:
            nested.rollback()
            batch.status = "ROLLED_BACK"
            batch.success_rows = 0
            batch.failed_rows = failed_count
        else:
            nested.commit()
            db.commit() # commit the outer transaction
            batch.status = "COMPLETED"
            batch.success_rows = success_count
            batch.failed_rows = 0
            
        db.commit()
        return failed_count == 0
        
    except Exception as e:
        db.rollback()
        batch.status = "FAILED"
        db.commit()
        logger.error(f"Execute import failed: {e}")
        raise
