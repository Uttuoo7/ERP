from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, schemas, models
from .services import onboarding_engine
from .dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/saas", tags=["SaaS Onboarding"])

@router.post("/onboard", status_code=status.HTTP_201_CREATED)
def onboard_new_tenant(request: schemas.SaaSOnboardingRequest, db: Session = Depends(database.get_db)):
    # Since this is a public endpoint, we bypass the tenant filter completely to create the initial structures.
    database.set_bypass_tenant_filter(True)
    try:
        # Check if domain already exists
        existing_domain = db.query(models.Tenant).filter(models.Tenant.domain == request.domain).first()
        if existing_domain:
            raise HTTPException(status_code=400, detail="Domain already registered")
            
        existing_email = db.query(models.User).filter(models.User.email == request.admin_email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Admin email already registered")
            
        tenant = onboarding_engine.provision_new_tenant(db, request)
        return {"message": "SaaS Tenant provisioned successfully", "tenant_id": str(tenant.id)}
    finally:
        database.set_bypass_tenant_filter(False)

@router.get("/tenants", response_model=list)
def get_tenants(db: Session = Depends(database.get_db), current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN]))):
    # Bypass tenant filter so Super Admin can see ALL tenants
    database.set_bypass_tenant_filter(True)
    try:
        tenants = db.query(models.Tenant).all()
        return [{"id": str(t.id), "name": t.name, "domain": t.domain, "subscription_plan": t.subscription_plan, "status": t.status} for t in tenants]
    finally:
        database.set_bypass_tenant_filter(False)

@router.get("/config", response_model=dict)
def get_tenant_config(db: Session = Depends(database.get_db), current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))):
    # This inherits the tenant filter automatically from the dependency
    config = db.query(models.TenantConfig).first()
    if not config:
        return {}
    return {
        "logo_url": config.logo_url,
        "theme_color": config.theme_color,
        "modules_enabled": config.modules_enabled_json
    }
