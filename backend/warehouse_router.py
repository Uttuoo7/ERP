from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from . import models, schemas, database

router = APIRouter()

@router.get("/", response_model=List[schemas.WarehouseResponse])
def get_warehouses(db: Session = Depends(database.get_db)):
    return db.query(models.Warehouse).all()

def seed_warehouses(db: Session):
    if db.query(models.Warehouse).count() == 0:
        warehouses = [
            models.Warehouse(
                warehouse_code="WH-MUM-01",
                name="Main Mumbai Plant",
                contact_person="Anand Verma",
                company_name="Zenith IoT Solutions",
                address_line1="Unit 401, Alpha Tech Park",
                address_line2="TTC Industrial Area, Mahape",
                landmark=None,
                city="Navi Mumbai",
                state="Maharashtra",
                pin_code="400710",
                phone="9876543210",
                gstin="27AAAAA0000A1Z5"
            ),
            models.Warehouse(
                warehouse_code="WH-BLR-01",
                name="Bangalore Storage",
                contact_person="Rajesh Nair",
                company_name="Zenith IoT Solutions",
                address_line1="No. 12, Export Promotion Industrial Park",
                address_line2="Whitefield",
                landmark=None,
                city="Bengaluru",
                state="Karnataka",
                pin_code="560066",
                phone="9876543211",
                gstin="29BBBBB0000B1Z5"
            )
        ]
        try:
            db.add_all(warehouses)
            db.commit()
        except Exception:
            db.rollback()
