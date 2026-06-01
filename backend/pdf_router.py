import uuid
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from . import database, dependencies, models
from .services import pdf_generator

router = APIRouter()

@router.get("/po/{po_id}")
def download_purchase_order_pdf(
    po_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generate and download a branded Purchase Order PDF."""
    try:
        pdf_bytes = pdf_generator.generate_purchase_order_pdf(db, str(po_id))
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=purchase_order_{po_id.hex[:6]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PO PDF: {e}")

@router.get("/grn/{grn_id}")
def download_goods_receipt_pdf(
    grn_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generate and download a branded Goods Receipt Note (GRN) PDF."""
    try:
        pdf_bytes = pdf_generator.generate_grn_pdf(db, str(grn_id))
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=grn_{grn_id.hex[:6]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate GRN PDF: {e}")

@router.get("/invoice/{invoice_id}")
def download_invoice_pdf(
    invoice_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generate and download a branded Supplier Invoice PDF."""
    try:
        pdf_bytes = pdf_generator.generate_invoice_pdf(db, str(invoice_id))
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=invoice_{invoice_id.hex[:6]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Invoice PDF: {e}")

@router.get("/material-issue/{issue_id}")
def download_material_issue_pdf(
    issue_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generate and download a branded Material Issue Slip PDF."""
    try:
        pdf_bytes = pdf_generator.generate_material_issue_pdf(db, issue_id)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=material_issue_{issue_id[:6]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Material Issue PDF: {e}")

@router.get("/gate-pass/{pass_id}")
def download_gate_pass_pdf(
    pass_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generate and download a branded Gate Pass PDF."""
    try:
        pdf_bytes = pdf_generator.generate_gate_pass_pdf(db, pass_id)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=gate_pass_{pass_id[:6]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Gate Pass PDF: {e}")
