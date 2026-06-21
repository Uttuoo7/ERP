from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
import uuid
from typing import List, Optional
from . import database, schemas, models
from .services import onboarding_engine
from .dependencies import get_current_user, require_role
from .services.certification_service import PlatformCertificationService
from .services.upgrade_manager import PlatformUpgradeManager
from .services.compatibility_manager import VersionCompatibilityManager

router = APIRouter(prefix="/api/saas", tags=["SaaS & Platform Administration"])

@router.post("/onboard", status_code=status.HTTP_201_CREATED)
def onboard_new_tenant(request: schemas.SaaSOnboardingRequest, db: Session = Depends(database.get_db)):
    database.set_bypass_tenant_filter(True)
    try:
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
    database.set_bypass_tenant_filter(True)
    try:
        tenants = db.query(models.Tenant).all()
        return [{"id": str(t.id), "name": t.name, "domain": t.domain, "subscription_plan": t.subscription_plan, "status": t.status} for t in tenants]
    finally:
        database.set_bypass_tenant_filter(False)

@router.get("/config", response_model=dict)
def get_tenant_config(db: Session = Depends(database.get_db), current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))):
    config = db.query(models.TenantConfig).first()
    if not config:
        return {}
    return {
        "logo_url": config.logo_url,
        "theme_color": config.theme_color,
        "modules_enabled": config.modules_enabled_json
    }

# --- FEATURE FLAGS ENDPOINTS ---

@router.get("/features", response_model=List[schemas.FeatureFlagResponse])
def list_feature_flags(
    env: str = "Production",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lists feature flags matching user's tenant or global defaults."""
    flags = db.query(models.FeatureFlag).filter(
        (models.FeatureFlag.tenant_id == current_user.tenant_id) | (models.FeatureFlag.tenant_id == None),
        models.FeatureFlag.environment == env
    ).all()
    return flags

@router.post("/features", response_model=schemas.FeatureFlagResponse, status_code=status.HTTP_201_CREATED)
def create_feature_flag(
    request: schemas.FeatureFlagCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))
):
    """Admin-only endpoint to create new global or tenant-specific feature flags."""
    existing = db.query(models.FeatureFlag).filter(
        models.FeatureFlag.feature_key == request.feature_key,
        models.FeatureFlag.tenant_id == current_user.tenant_id,
        models.FeatureFlag.environment == request.environment
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feature flag already exists for this tenant/environment.")
        
    flag = models.FeatureFlag(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        feature_key=request.feature_key,
        enabled=request.enabled,
        rollout_percentage=request.rollout_percentage,
        environment=request.environment,
        minimum_license=request.minimum_license
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag

@router.put("/features/{flag_id}", response_model=schemas.FeatureFlagResponse)
def update_feature_flag(
    flag_id: uuid.UUID,
    request: schemas.FeatureFlagUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))
):
    """Updates active feature flag parameters."""
    flag = db.query(models.FeatureFlag).filter(models.FeatureFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found.")
        
    if request.enabled is not None:
        flag.enabled = request.enabled
    if request.rollout_percentage is not None:
        flag.rollout_percentage = request.rollout_percentage
    if request.environment is not None:
        flag.environment = request.environment
    if request.minimum_license is not None:
        flag.minimum_license = request.minimum_license
        
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag

# --- PLUGIN STATES ENDPOINTS ---

@router.get("/plugins/state", response_model=List[schemas.PluginStateResponse])
def get_plugin_states(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieves all plugin states registered under current tenant."""
    states = db.query(models.PluginState).filter(models.PluginState.tenant_id == current_user.tenant_id).all()
    return states

@router.put("/plugins/state/{plugin_key}", response_model=schemas.PluginStateResponse)
def configure_plugin_state(
    plugin_key: str,
    request: schemas.PluginStateUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))
):
    """Updates runtime configurations, versions or enabled state of a plugin."""
    state = db.query(models.PluginState).filter(
        models.PluginState.tenant_id == current_user.tenant_id,
        models.PluginState.plugin_key == plugin_key
    ).first()
    
    if not state:
        state = models.PluginState(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            plugin_key=plugin_key,
            enabled=request.enabled,
            license_level=request.license_level or "standard",
            configuration_json=request.configuration_json,
            installed_version=request.installed_version or "1.0.0",
            is_certified=False
        )
    else:
        state.enabled = request.enabled
        if request.license_level:
            state.license_level = request.license_level
        if request.configuration_json is not None:
            state.configuration_json = request.configuration_json
        if request.installed_version:
            state.installed_version = request.installed_version
            
    db.add(state)
    db.commit()
    db.refresh(state)
    return state

@router.post("/plugins/certify/{plugin_key}", response_model=dict)
def certify_plugin_endpoint(
    plugin_key: str,
    manifest: dict,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))
):
    """Triggers the certification verification process for a plugin manifest."""
    state = db.query(models.PluginState).filter(
        models.PluginState.tenant_id == current_user.tenant_id,
        models.PluginState.plugin_key == plugin_key
    ).first()
    
    if not state:
        raise HTTPException(status_code=404, detail="Plugin state record not found. Save state first.")
        
    is_certified, warnings = PlatformCertificationService.certify_plugin(manifest)
    state.is_certified = is_certified
    db.add(state)
    db.commit()
    
    return {
        "is_certified": is_certified,
        "warnings": warnings,
        "plugin_key": plugin_key
    }

@router.post("/plugins/migrate/{plugin_key}", response_model=dict)
def trigger_plugin_migration(
    plugin_key: str,
    action: str,  # onInstall, onUpgrade, onDowngrade, onUninstall
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))
):
    """Triggers migration script pipelines for the target plugin."""
    success = PlatformUpgradeManager.execute_plugin_migration(db, current_user.tenant_id, plugin_key, action)
    if not success:
        raise HTTPException(status_code=500, detail="Plugin migration failed.")
    return {"message": "Plugin migration completed successfully", "plugin_key": plugin_key, "action": action}
