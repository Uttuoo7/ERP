from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def register_asset(db: Session, asset_data: schemas.AssetCreate) -> models.Asset:
    asset = models.Asset(
        **asset_data.model_dump()
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset
