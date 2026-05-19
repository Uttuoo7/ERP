from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from . import database

# Create database tables
os.makedirs('uploads', exist_ok=True)
Base.metadata.create_all(bind=engine)

# Seed users and warehouses
with database.SessionLocal() as db:
    seed_users(db)
    seed_warehouses(db)

app = FastAPI(title="P2P ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(vendor_router, prefix="/api/vendors", tags=["Vendors"])
app.include_router(item_router, prefix="/api/items", tags=["Items"])
app.include_router(so_router, prefix="/api/sales-orders", tags=["Internal Sales Orders"])
app.include_router(po_router, prefix="/api/pos", tags=["Purchase Orders"])
app.include_router(grn_router, prefix="/api/grns", tags=["Goods Receipt Notes"])
app.include_router(invoice_router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(warehouse_router, prefix="/api/warehouses", tags=["Warehouses"])
app.include_router(attachment_router, prefix="/api/attachments", tags=["Attachments"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the P2P ERP API"}
