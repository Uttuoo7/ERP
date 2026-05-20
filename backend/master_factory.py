import csv
import io
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Type, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, String, cast
from . import database, dependencies, models

logger = logging.getLogger(__name__)

def create_master_router(
    model: Type[models.BaseMaster],
    response_schema: Type,
    create_schema: Type,
    update_schema: Type,
    name: str,
    path_name: str,
    search_fields: List[str]
) -> APIRouter:
    router = APIRouter()

    @router.get("/", response_model=Dict[str, Any])
    def list_master(
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=100),
        search: Optional[str] = Query(None),
        is_active: Optional[bool] = Query(None),
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        query = db.query(model).filter(model.is_deleted == False)

        if is_active is not None:
            query = query.filter(model.is_active == is_active)

        if search and search_fields:
            search_filters = []
            for field in search_fields:
                column = getattr(model, field, None)
                if column is not None:
                    # Case-insensitive partial search
                    search_filters.append(cast(column, String).ilike(f"%{search}%"))
            if search_filters:
                query = query.filter(or_(*search_filters))

        total = query.count()
        offset = (page - 1) * limit
        items = query.order_by(model.created_at.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }

    @router.get("/export")
    def export_csv(
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        query = db.query(model).filter(model.is_deleted == False)
        items = query.all()

        # CSV generation
        output = io.StringIO()
        writer = csv.writer(output)

        # Get header from columns
        columns = [c.name for c in model.__table__.columns if c.name not in ["is_deleted"]]
        writer.writerow(columns)

        for item in items:
            row = [getattr(item, col) for col in columns]
            writer.writerow(row)

        output.seek(0)
        response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename={path_name}_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        return response

    @router.post("/bulk-import", status_code=status.HTTP_201_CREATED)
    async def bulk_import(
        file: UploadFile = File(...),
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported.")

        content = await file.read()
        try:
            decoded = content.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(decoded))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid file encoding: {str(e)}")

        imported_count = 0
        error_rows = []

        for idx, row in enumerate(csv_reader):
            try:
                # Basic validation using pydantic schema if possible or standard parsing
                # Dynamically construct model inputs
                model_data = {}
                for col in model.__table__.columns:
                    col_name = col.name
                    if col_name in ["id", "created_at", "updated_at", "created_by_id", "updated_by_id", "is_deleted"]:
                        continue
                    if col_name in row:
                        val = row[col_name]
                        # Handle basic conversions
                        if val == "":
                            val = None
                        elif col.type.python_type == bool:
                            val = val.lower() in ("true", "1", "yes")
                        elif col.type.python_type == uuid.UUID:
                            val = uuid.UUID(val) if val else None
                        elif col.type.python_type == datetime:
                            val = datetime.fromisoformat(val) if val else None
                        
                        model_data[col_name] = val

                db_item = model(**model_data)
                db_item.created_by_id = current_user.id
                db.add(db_item)
                imported_count += 1
            except Exception as row_error:
                error_rows.append({"row": idx + 1, "error": str(row_error)})

        if error_rows:
            db.rollback()
            raise HTTPException(
                status_code=400, 
                detail={"message": "Failed to import some rows. All changes rolled back.", "errors": error_rows}
            )

        db.commit()
        logger.info(f"User {current_user.username} imported {imported_count} records into {name}")
        return {"message": f"Successfully imported {imported_count} records.", "count": imported_count}

    @router.get("/{item_id}", response_model=response_schema)
    def get_master_item(
        item_id: uuid.UUID,
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        db_item = db.query(model).filter(and_(model.id == item_id, model.is_deleted == False)).first()
        if not db_item:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        return db_item

    @router.post("/", response_model=response_schema, status_code=status.HTTP_201_CREATED)
    def create_master_item(
        payload: create_schema,
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        # Prevent duplicates on unique constraint fields dynamically if possible
        # Check standard fields like code or sku
        for field in ["code", "sku", "employee_id", "customer_number"]:
            if hasattr(payload, field):
                val = getattr(payload, field)
                if val:
                    existing = db.query(model).filter(getattr(model, field) == val).first()
                    if existing:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Record with this {field} '{val}' already exists in {name}."
                        )

        db_item = model(**payload.model_dump())
        db_item.created_by_id = current_user.id
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        logger.info(f"User {current_user.username} created new {name} with ID {db_item.id}")
        return db_item

    @router.put("/{item_id}", response_model=response_schema)
    def update_master_item(
        item_id: uuid.UUID,
        payload: update_schema,
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        db_item = db.query(model).filter(and_(model.id == item_id, model.is_deleted == False)).first()
        if not db_item:
            raise HTTPException(status_code=404, detail=f"{name} not found")

        # Prevent duplicate code updates
        for field in ["code", "sku", "employee_id", "customer_number"]:
            if hasattr(payload, field):
                val = getattr(payload, field)
                if val:
                    existing = db.query(model).filter(and_(getattr(model, field) == val, model.id != item_id)).first()
                    if existing:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Another record with this {field} '{val}' already exists in {name}."
                        )

        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(db_item, key, value)
        
        db_item.updated_by_id = current_user.id
        db_item.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_item)
        logger.info(f"User {current_user.username} updated {name} ID {db_item.id}")
        return db_item

    @router.delete("/{item_id}")
    def delete_master_item(
        item_id: uuid.UUID,
        db: Session = Depends(database.get_db),
        current_user: models.User = Depends(dependencies.get_current_user)
    ):
        db_item = db.query(model).filter(and_(model.id == item_id, model.is_deleted == False)).first()
        if not db_item:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        
        # Soft delete
        db_item.is_deleted = True
        db_item.updated_by_id = current_user.id
        db_item.updated_at = datetime.utcnow()
        db.commit()
        logger.info(f"User {current_user.username} soft-deleted {name} ID {item_id}")
        return {"status": "ok", "message": f"{name} deleted successfully"}

    return router
