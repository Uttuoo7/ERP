import uuid
from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.orm import Session
from backend.models import Base
from backend.database import get_current_tenant_id

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    """
    Generic Base Repository implementing standard CRUD database patterns.
    Automatically handles active tenant-isolation checks and soft-deletes.
    """
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """Fetch a specific record by its primary key ID."""
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Fetch a range of records, supporting pagination bounds."""
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: Any) -> ModelType:
        """Instantiate and store a new entity record."""
        # Convert Pydantic schemas or dicts to SQLAlchemy model maps
        if isinstance(obj_in, dict):
            obj_data = obj_in
        else:
            obj_data = obj_in.dict(exclude_unset=True)
            
        # Ensure active tenant context is injected
        if "tenant_id" not in obj_data:
            tenant_id = get_current_tenant_id()
            if tenant_id:
                obj_data["tenant_id"] = tenant_id

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: ModelType, obj_in: Any) -> ModelType:
        """Update an existing database entity record."""
        obj_data = obj_in if isinstance(obj_in, dict) else obj_in.dict(exclude_unset=True)
        
        for field in obj_data:
            if hasattr(db_obj, field):
                setattr(db_obj, field, obj_data[field])
                
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any) -> Optional[ModelType]:
        """Perform a secure logical soft-delete operation on a record."""
        db_obj = db.query(self.model).filter(self.model.id == id).first()
        if db_obj:
            # Perform logical soft delete
            db_obj.is_deleted = True
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
        return db_obj
