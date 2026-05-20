import uuid
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from . import models, event_dispatcher

logger = logging.getLogger(__name__)

def create_relationship(
    db: Session,
    source_type: str,
    source_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    relationship_type: str,
    line_links: List[Dict[str, Any]],
    user_id: uuid.UUID
) -> models.DocumentRelationship:
    """
    Creates linkage relations between any two transaction header documents and their lines.
    """
    logger.info(f"Traceability Engine: Creating relationship between {source_type} ({source_id}) and {target_type} ({target_id})")
    
    # 1. Header relationship
    relationship = models.DocumentRelationship(
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
        target_id=target_id,
        relationship_type=relationship_type,
        created_by_id=user_id
    )
    db.add(relationship)
    db.flush() # Resolve relationship.id
    
    # 2. Line relationships
    for link in line_links:
        line_link = models.DocumentLineRelationship(
            document_relationship_id=relationship.id,
            source_line_id=link["source_line_id"],
            target_line_id=link["target_line_id"],
            quantity_converted=link["quantity_converted"],
            conversion_status=link.get("conversion_status", "COMPLETED"),
            created_by_id=user_id
        )
        db.add(line_link)
        
    db.commit()
    db.refresh(relationship)
    
    # Dispatch linkage event
    event_dispatcher.dispatch(
        "relationship_created",
        {
            "relationship_id": relationship.id,
            "source_type": source_type,
            "source_id": source_id,
            "target_type": target_type,
            "target_id": target_id,
            "user_id": user_id,
            "action": "LINKED",
            "details": f"Established {relationship_type} dependency linkage mapping {len(line_links)} items."
        },
        db
    )
    
    return relationship

def get_document_node_metadata(db: Session, doc_type: str, doc_id: uuid.UUID) -> Dict[str, Any]:
    """
    Loads unified representation details (IDs, amounts, status, names) for target documents.
    """
    result = {
        "id": doc_id,
        "document_number": f"{doc_type} Ref: {str(doc_id)[:6].upper()}",
        "document_type": doc_type,
        "status": "ACTIVE",
        "created_at": datetime_now_placeholder(),
        "creator_name": "System",
        "estimated_amount": 0.0
    }
    
    try:
        if doc_type == "PURCHASE_REQUISITION":
            pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == doc_id).first()
            if pr:
                result["document_number"] = pr.pr_number
                result["status"] = pr.status
                result["created_at"] = pr.created_at
                result["creator_name"] = f"{pr.requester.first_name} {pr.requester.last_name}"
                result["estimated_amount"] = float(sum(line.estimated_price * line.quantity for line in pr.line_items))
                
        elif doc_type == "PURCHASE_ORDER":
            po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == doc_id).first()
            if po:
                result["document_number"] = po.po_number
                result["status"] = po.status.value if hasattr(po.status, 'value') else str(po.status)
                result["created_at"] = po.created_at
                result["creator_name"] = f"{po.creator.first_name} {po.creator.last_name}" if po.creator else "System"
                result["estimated_amount"] = float(po.total_amount)
                
        elif doc_type == "INTERNAL_SALES_ORDER":
            so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == doc_id).first()
            if so:
                result["document_number"] = so.so_number
                result["status"] = so.status
                result["created_at"] = so.created_at
                result["creator_name"] = f"{so.creator.first_name} {so.creator.last_name}" if so.creator else "System"
                result["estimated_amount"] = float(so.total_amount)
                
        elif doc_type == "GRN":
            grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == doc_id).first()
            if grn:
                result["document_number"] = grn.grn_number
                result["status"] = "RECEIVED"
                result["created_at"] = grn.created_at
                result["creator_name"] = f"{grn.receiver.first_name} {grn.receiver.last_name}" if grn.receiver else "System"
                
        elif doc_type == "INVOICE":
            invoice = db.query(models.Invoice).filter(models.Invoice.id == doc_id).first()
            if invoice:
                result["document_number"] = invoice.invoice_number
                result["status"] = invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status)
                result["created_at"] = invoice.created_at
                result["creator_name"] = "Vendor System"
                result["estimated_amount"] = float(invoice.total_amount)
                
    except Exception as e:
        logger.error(f"Error resolving lineage node metadata for {doc_type} ID {doc_id}: {str(e)}")
        
    return result

def get_document_lineage(db: Session, doc_type: str, doc_id: uuid.UUID) -> Dict[str, Any]:
    """
    Constructs a direct lineage tree fetching all upstream (parent) and downstream (child) link chains.
    """
    # 1. Resolve source metadata node
    source_node = get_document_node_metadata(db, doc_type, doc_id)
    
    # 2. Upstream Parents (target_id matches current doc_id)
    parents = db.query(models.DocumentRelationship)\
        .filter(models.DocumentRelationship.target_id == doc_id)\
        .all()
        
    # 3. Downstream Children (source_id matches current doc_id)
    children = db.query(models.DocumentRelationship)\
        .filter(models.DocumentRelationship.source_id == doc_id)\
        .all()
        
    return {
        "source_node": source_node,
        "parents": parents,
        "children": children
    }

def datetime_now_placeholder():
    from datetime import datetime
    return datetime.utcnow()
