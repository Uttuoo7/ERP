import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, document_traceability

router = APIRouter()

@router.get("/lineage/{doc_type}/{doc_id}", response_model=schemas.DocumentLineageGraphResponse)
def fetch_lineage(
    doc_type: str,
    doc_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Recursive traversal endpoint: Maps upstream and downstream lineage trails for target document details.
    """
    valid_modules = [
        "PURCHASE_REQUISITION", "PURCHASE_ORDER", "INTERNAL_SALES_ORDER", 
        "GRN", "INVOICE", "RFQ", "PROJECT", "CRM_OPPORTUNITY"
    ]
    
    if doc_type.upper() not in valid_modules:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid transaction document type '{doc_type}'. Supported types: {valid_modules}"
        )
        
    return document_traceability.get_document_lineage(db, doc_type.upper(), doc_id)

@router.post("/relationships", response_model=schemas.DocumentRelationshipResponse, status_code=status.HTTP_201_CREATED)
def link_documents(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Creates custom dependency relationships between two documents at header and line level.
    """
    try:
        source_type = payload["source_type"]
        source_id = uuid.UUID(payload["source_id"])
        target_type = payload["target_type"]
        target_id = uuid.UUID(payload["target_id"])
        relationship_type = payload.get("relationship_type", "CONVERSION")
        
        raw_lines = payload.get("line_links", [])
        line_links = []
        for line in raw_lines:
            line_links.append({
                "source_line_id": uuid.UUID(line["source_line_id"]),
                "target_line_id": uuid.UUID(line["target_line_id"]),
                "quantity_converted": float(line["quantity_converted"]),
                "conversion_status": line.get("conversion_status", "COMPLETED")
            })
            
        return document_traceability.create_relationship(
            db=db,
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            relationship_type=relationship_type,
            line_links=line_links,
            user_id=current_user.id
        )
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing key in link payload: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formatting parse error: {str(e)}")
