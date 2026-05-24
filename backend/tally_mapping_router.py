import uuid
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from . import models, database, dependencies

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
def get_mappings(
    entity_type: str = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """Get Tally ledger mappings."""
    query = db.query(models.TallyLedgerMapping)
    if entity_type:
        query = query.filter(models.TallyLedgerMapping.entity_type == entity_type)
    return query.all()

@router.post("/")
def create_mapping(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """Create or update a Tally ledger mapping."""
    mapping = db.query(models.TallyLedgerMapping).filter(
        models.TallyLedgerMapping.entity_type == payload.get("entity_type"),
        models.TallyLedgerMapping.internal_id == payload.get("internal_id")
    ).first()
    
    if mapping:
        mapping.tally_ledger_name = payload.get("tally_ledger_name")
        mapping.is_synced = True
    else:
        mapping = models.TallyLedgerMapping(
            entity_type=payload.get("entity_type"),
            internal_id=payload.get("internal_id"),
            tally_ledger_name=payload.get("tally_ledger_name"),
            is_synced=True
        )
        db.add(mapping)
        
    db.commit()
    db.refresh(mapping)
    return mapping

@router.delete("/{mapping_id}")
def delete_mapping(
    mapping_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    mapping = db.query(models.TallyLedgerMapping).filter(models.TallyLedgerMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
    return {"message": "Mapping deleted"}
