from datetime import datetime
from sqlalchemy.orm import Session
import re

from . import models

def get_financial_year(dt: datetime) -> str:
    """
    Returns the financial year string based on the standard April-March cycle.
    Example: '26-27'
    """
    if dt.month >= 4:
        start_year = dt.year
        end_year = start_year + 1
    else:
        start_year = dt.year - 1
        end_year = dt.year
        
    return f"{str(start_year)[-2:]}-{str(end_year)[-2:]}"

def generate_document_number(db: Session, prefix: str, model_class, field_name: str) -> str:
    """
    Generates an auto-incrementing document number format: PREFIX/FY/SEQUENCE
    Example: PO/26-27/000145
    """
    fy = get_financial_year(datetime.utcnow())
    base_prefix = f"{prefix}/{fy}/"
    
    # Get the latest document matching this prefix and FY
    last_record = db.query(getattr(model_class, field_name))\
        .filter(getattr(model_class, field_name).like(f"{base_prefix}%"))\
        .order_by(getattr(model_class, field_name).desc())\
        .first()
        
    if last_record:
        last_doc_num = last_record[0]
        # Extract sequence from end
        match = re.search(r'(\d+)$', last_doc_num)
        if match:
            seq = int(match.group(1)) + 1
            return f"{base_prefix}{seq:06d}"
            
    return f"{base_prefix}000001"
