from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback

from .logging_config import logger, tenant_id_var, user_id_var
import time
from asgi_correlation_id import CorrelationIdMiddleware
from asgi_correlation_id.context import correlation_id
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from .database import engine
from .models import Base
from .vendor_router import router as vendor_router
from .item_router import router as item_router
from .po_router import router as po_router
from .so_router import router as so_router
from .grn_router import router as grn_router
from .invoice_router import router as invoice_router
from .warehouse_router import router as warehouse_router, seed_warehouses
from .attachment_router import router as attachment_router
import os
from .auth_router import router as auth_router, seed_users
from .analytics_router import router as analytics_router
from .document_router import router as document_router
from . import database

os.makedirs('uploads', exist_ok=True)
# Note: Database creation and migration is now handled by Alembic.
# Run 'alembic upgrade head' before starting the application.
logger.info("Application starting. Ensure Alembic migrations are up to date.")

# Seed users and warehouses (skip during testing — tests manage their own DB)
if not os.getenv("TESTING"):
    try:
        with database.SessionLocal() as db:
            seed_users(db)
            seed_warehouses(db)
    except Exception as e:
        logger.warning(f"Seeding failed (may be benign on restart): {e}")

from contextlib import asynccontextmanager
from .websocket_manager import manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Connecting to Redis Pub/Sub for WebSockets...")
    await manager.connect_redis()
    yield
    # Shutdown
    if manager.listen_task:
        manager.listen_task.cancel()

app = FastAPI(title="P2P ERP API", lifespan=lifespan)

# Setup Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Setup Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Setup Observability Middlewares
app.add_middleware(CorrelationIdMiddleware)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.perf_counter()
        
        # We can extract basic auth/tenant info from headers for logging
        # Alternatively, routers can set this contextvar later.
        
        response = await call_next(request)
        
        duration_ms = (time.perf_counter() - start_time) * 1000
        
        logger.info(
            "Request completed",
            extra={
                "endpoint": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2)
            }
        )
        return response

app.add_middleware(RequestLoggingMiddleware)
# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        f"Global Exception caught: {exc}", 
        extra={
            "endpoint": request.url.path,
            "method": request.method
        }
    )
    return JSONResponse(
        status_code=500,
        content={"message": "An internal server error occurred.", "detail": str(exc)},
    )

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .core.middleware.tenant_middleware import TenantMiddleware
app.add_middleware(TenantMiddleware)

from .middleware.apm_middleware import APMMiddleware
app.add_middleware(APMMiddleware)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "ERP Backend is running smoothly."}

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])

# Dynamic Master Routers
from .master_factory import create_master_router
from . import schemas, models

app.include_router(
    create_master_router(models.Department, schemas.DepartmentResponse, schemas.DepartmentCreate, schemas.DepartmentUpdate, "Department", "departments", ["code", "name"]),
    prefix="/api/masters/departments",
    tags=["Master Department"]
)
app.include_router(
    create_master_router(models.CostCenter, schemas.CostCenterResponse, schemas.CostCenterCreate, schemas.CostCenterUpdate, "CostCenter", "cost-centers", ["code", "name"]),
    prefix="/api/masters/cost-centers",
    tags=["Master Cost Center"]
)
app.include_router(
    create_master_router(models.Project, schemas.ProjectResponse, schemas.ProjectCreate, schemas.ProjectUpdate, "Project", "projects", ["code", "name"]),
    prefix="/api/masters/projects",
    tags=["Master Project"]
)
app.include_router(
    create_master_router(models.Employee, schemas.EmployeeResponse, schemas.EmployeeCreate, schemas.EmployeeUpdate, "Employee", "employees", ["employee_id", "first_name", "last_name", "email"]),
    prefix="/api/masters/employees",
    tags=["Master Employee"]
)
app.include_router(
    create_master_router(models.Customer, schemas.CustomerResponse, schemas.CustomerCreate, schemas.CustomerUpdate, "Customer", "customers", ["customer_number", "name", "email"]),
    prefix="/api/masters/customers",
    tags=["Master Customer"]
)

app.include_router(vendor_router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(item_router, prefix="/api/items", tags=["Items"])
app.include_router(so_router, prefix="/api/sales-orders", tags=["Internal Sales Orders"])
app.include_router(po_router, prefix="/api/pos", tags=["Purchase Orders"])

from .pr_router import router as pr_router
app.include_router(pr_router, prefix="/api/pos/requisitions", tags=["Purchase Requisitions"])

from .traceability_router import router as traceability_router
app.include_router(traceability_router, prefix="/api/traceability", tags=["Document Traceability"])

from .rfq_router import router as rfq_router
app.include_router(rfq_router, prefix="/api/pos/rfqs", tags=["Request For Quotations"])

app.include_router(grn_router, prefix="/api/grns", tags=["Goods Receipt Notes"])
app.include_router(invoice_router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(warehouse_router, prefix="/api/warehouses", tags=["Warehouses"])
app.include_router(attachment_router, prefix="/api/attachments", tags=["Attachments"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(document_router, prefix="/api/documents", tags=["documents"])
from .integration_router import router as integration_router_instance
app.include_router(integration_router_instance, prefix="/api/integrations", tags=["Integrations"])

from .tally_mapping_router import router as tally_mapping_router
app.include_router(tally_mapping_router, prefix="/api/tally-mappings", tags=["Tally Mappings"])

from .tally_reconciliation_router import router as tally_reconciliation_router
app.include_router(tally_reconciliation_router, prefix="/api/tally-reconciliation", tags=["Tally Reconciliation"])

from .import_router import router as import_router
app.include_router(import_router, prefix="/api/import", tags=["Data Import System"])

from .sla_router import router as sla_router
app.include_router(sla_router, prefix="/api/sla", tags=["SLA & Escalations"])

from .observability_router import router as observability_router
app.include_router(observability_router, prefix="/api/observability", tags=["System Observability"])

from .inventory_router import router as inventory_router
app.include_router(inventory_router, prefix="/api/inventory", tags=["Inventory Ledger & Balances"])

from .finance_router import router as finance_router
app.include_router(finance_router, prefix="/api/finance", tags=["Universal Finance & Ledger Engine"])

from .workflow_router import router as workflow_router
app.include_router(workflow_router, prefix="/api/workflow", tags=["Approval Workflows"])

from .rbac_router import router as rbac_router
app.include_router(rbac_router, prefix="/api/auth/rbac", tags=["Role-Based Access Control"])

from .notification_engine import router as notification_router
app.include_router(notification_router, prefix="/api/notifications", tags=["In-App Notifications Hub"])

from .reporting_router import router as reporting_router
app.include_router(reporting_router, prefix="/api/reports", tags=["Analytical CSV Reports Engine"])

from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # We don't necessarily expect clients to send data, but we must await
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Ignore API routes
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
            
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to the P2P ERP API. Frontend build not found."}
