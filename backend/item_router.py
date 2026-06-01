from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies
import uuid

router = APIRouter()

@router.post("/", response_model=schemas.ItemResponse)
def create_item(item: schemas.ItemCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER, models.Role.WAREHOUSE]))):
    db_item = db.query(models.Item).filter(models.Item.sku == item.sku).first()
    if db_item:
        raise HTTPException(status_code=400, detail="SKU already registered")
        
    item_data = item.model_dump()
    db_item = models.Item(**item_data)
    db.add(db_item)
    db.flush()
    
    # Initialize ledger with 0 stock
    ledger = models.InventoryLedger(
        item_id=db_item.id,
        quantity_on_hand=0,
        quantity_reserved=0,
        reorder_point=item.reorder_level
    )
    db.add(ledger)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/", response_model=List[schemas.ItemResponse])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    items = db.query(models.Item).offset(skip).limit(limit).all()
    return items

@router.get("/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_item

@router.put("/{item_id}", response_model=schemas.ItemResponse)
def update_item(item_id: uuid.UUID, item: schemas.ItemUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))):
    with db.begin():
        db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
        if db_item is None:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if item.sku != db_item.sku:
            existing_item = db.query(models.Item).filter(models.Item.sku == item.sku).first()
            if existing_item:
                raise HTTPException(status_code=400, detail="SKU already registered")
            
        item_data = item.model_dump()
        for key, value in item_data.items():
            setattr(db_item, key, value)
        
        db.refresh(db_item)
        return db_item

@router.delete("/{item_id}")
def delete_item(item_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"ok": True}
