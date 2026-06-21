import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas, database, auth_utils, dependencies
from .services.compatibility_manager import VersionCompatibilityManager

router = APIRouter()

from .limiter import limiter

@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, login_data: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(
        (models.User.email == login_data.email) | (models.User.username == login_data.email)
    ).first()
    if not user or not auth_utils.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": str(user.tenant_id)}
    access_token = auth_utils.create_access_token(data=token_data)
    refresh_token = auth_utils.create_refresh_token(data=token_data)
    
    # Store initial refresh token
    db_refresh_token = models.RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=auth_utils.get_refresh_token_expiry()
    )
    db.add(db_refresh_token)
    db.commit()
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer", 
        "role": user.role
    }

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(refresh_data: schemas.TokenRefresh, db: Session = Depends(database.get_db)):
    # 1. Decode and basic check
    payload = auth_utils.decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    
    user_id = payload.get("sub")
    
    # 2. Check Database for rotation/revocation
    db_token = db.query(models.RefreshToken).filter(models.RefreshToken.token == refresh_data.refresh_token).first()
    
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")
        
    if db_token.is_revoked:
        # POTENTIAL REUSE DETECTED: Revoke all tokens for this user for safety
        db.query(models.RefreshToken).filter(models.RefreshToken.user_id == user_id).update({"is_revoked": True})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked (reuse detected)")

    if db_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # 3. ROTATION: Revoke OLD, Issue NEW
    db_token.is_revoked = True
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": str(user.tenant_id)}
    new_access_token = auth_utils.create_access_token(data=token_data)
    new_refresh_token = auth_utils.create_refresh_token(data=token_data)
    
    # Store NEW refresh token
    new_db_token = models.RefreshToken(
        token=new_refresh_token,
        user_id=user.id,
        expires_at=auth_utils.get_refresh_token_expiry()
    )
    db.add(new_db_token)
    db.commit()
    
    return {
        "access_token": new_access_token, 
        "refresh_token": new_refresh_token,
        "token_type": "bearer", 
        "role": user.role
    }

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(dependencies.get_current_user)):
    return current_user

@router.get("/enterprise-context")
def get_enterprise_context(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: Session = Depends(database.get_db)
):
    import os
    # Lookup company name
    company_name = "Default Company"
    currency = "USD"
    if current_user.company_id:
        company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
        if company:
            company_name = company.name
            currency = company.base_currency or "USD"
            
    # Lookup plant/branch name
    plant_name = "Default Plant"
    if current_user.branch_id:
        branch = db.query(models.Branch).filter(models.Branch.id == current_user.branch_id).first()
        if branch:
            plant_name = branch.name
            
    # Lookup warehouse (find first warehouse under the user's company/tenant)
    warehouse_name = "Default Warehouse"
    warehouse = db.query(models.Warehouse).first()
    if warehouse:
        warehouse_name = warehouse.name

    # Determine environment based on configuration or hostname
    env = os.getenv("ENVIRONMENT", "Development")

    return {
        "company": company_name,
        "businessUnit": f"{plant_name} Operations",
        "warehouse": warehouse_name,
        "plant": plant_name,
        "financialYear": "2026-27",
        "database": "SQLite (Production)",
        "environment": env,
        "apiStatus": "Healthy",
        "language": "English (US)",
        "currency": "INR (₹)" if currency == "INR" else f"{currency} ($)",
    }

def seed_users(db: Session):
    # Ensure a default tenant exists
    tenant = db.query(models.Tenant).filter(models.Tenant.domain == "apexglobal.com").first()
    if not tenant:
        tenant = models.Tenant(
            name="Apex Global Ltd",
            domain="apexglobal.com",
            subscription_plan="ENTERPRISE"
        )
        db.add(tenant)
        db.flush()
        
        # Add tenant config
        config = models.TenantConfig(
            tenant_uuid=tenant.id,
            tenant_id=tenant.id,
            theme_color="#1e3a8a",
            logo_url="/logo.png"
        )
        db.add(config)
        db.flush()

    # Ensure a default company exists
    company = db.query(models.Company).filter(models.Company.name == "Apex Global Industries Ltd").first()
    if not company:
        company = models.Company(
            tenant_uuid=tenant.id,
            tenant_id=tenant.id,
            name="Apex Global Industries Ltd",
            base_currency="INR"
        )
        db.add(company)
        db.flush()

    # Ensure a default branch exists
    branch = db.query(models.Branch).filter(models.Branch.name == "Plant-01 Assembly Line").first()
    if not branch:
        branch = models.Branch(
            company_id=company.id,
            tenant_id=tenant.id,
            name="Plant-01 Assembly Line",
            is_headquarters=True
        )
        db.add(branch)
        db.flush()

    roles = {
        "admin": models.Role.ADMIN,
        "buyer": models.Role.BUYER,
        "warehouse": models.Role.WAREHOUSE,
        "finance": models.Role.FINANCE
    }
    for username, role in roles.items():
        email = f"{username}@example.com"
        db_user = db.query(models.User).filter(models.User.email == email).first()
        if not db_user:
            user = models.User(
                username=username,
                email=email,
                hashed_password=auth_utils.get_password_hash("password"),
                role=role,
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id
            )
            db.add(user)
        else:
            db_user.company_id = company.id
            db_user.branch_id = branch.id
    db.commit()


# --- USER PREFERENCES API ---

def migrate_preferences(preferences_json: str, old_version: str) -> str:
    """Non-destructive preferences schema migration utility."""
    import json
    try:
        data = json.loads(preferences_json)
    except Exception:
        data = {}
    
    # Schema evolution: ensure standard settings parameters exist
    if "general" not in data:
        data["general"] = {
            "landingPage": "/dashboard",
            "company": "",
            "warehouse": "",
            "language": "en",
            "currency": "USD",
            "timezone": "UTC"
        }
    if "appearance" not in data:
        data["appearance"] = {
            "theme": "light",
            "density": "comfortable"
        }
    if "navigation" not in data:
        data["navigation"] = {
            "favorites": [],
            "ribbon": {}
        }
    if "dashboard" not in data:
        data["dashboard"] = {
            "layout": {}
        }
    if "notifications" not in data:
        data["notifications"] = {
            "routing": ["desktop", "email", "sound"]
        }
    if "keyboard" not in data:
        data["keyboard"] = {
            "shortcuts": {}
        }
    if "accessibility" not in data:
        data["accessibility"] = {
            "screenReader": False,
            "reducedMotion": False
        }
        
    return json.dumps(data)

@router.get("/preferences", response_model=schemas.UserPreferenceResponse)
def get_user_preferences(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """Fetches user preference profile, running schema migration automatically if necessary."""
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == current_user.id).first()
    if not pref:
        # Create default empty preference profile
        pref = models.UserPreference(
            id=uuid.uuid4(),
            user_id=current_user.id,
            settings_schema_version="v1.0",
            preferences_json="{}"
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    # Version check
    if pref.settings_schema_version != "v1.0" or pref.migration_required:
        migrated_json = migrate_preferences(pref.preferences_json, pref.settings_schema_version)
        pref.preferences_json = migrated_json
        pref.settings_schema_version = "v1.0"
        pref.last_migrated = datetime.utcnow()
        pref.migration_required = False
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref

@router.put("/preferences", response_model=schemas.UserPreferenceResponse)
def update_user_preferences(request: schemas.UserPreferenceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """Updates user preference profile and logs history in preference audit logs."""
    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = models.UserPreference(
            id=uuid.uuid4(),
            user_id=current_user.id,
            settings_schema_version="v1.0"
        )
        db.add(pref)
        db.flush()

    old_val = pref.preferences_json
    pref.preferences_json = request.preferences_json
    db.add(pref)
    
    # Audit log
    audit = models.PreferenceAuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        action="Preference Changed",
        previous_value=old_val,
        new_value=request.preferences_json
    )
    db.add(audit)
    db.commit()
    db.refresh(pref)
    return pref

@router.get("/preferences/export", response_model=schemas.PreferenceImportSchema)
def export_user_preferences(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """Exports user preference manifest containing schema version and settings JSON."""
    pref = get_user_preferences(db, current_user)
    return schemas.PreferenceImportSchema(
        settings_schema_version=pref.settings_schema_version,
        preferences_json=pref.preferences_json
    )

@router.post("/preferences/import", response_model=schemas.UserPreferenceResponse)
def import_user_preferences(request: schemas.PreferenceImportSchema, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """Imports user preference manifest after validation of schema version."""
    if not VersionCompatibilityManager.is_compatible(request.settings_schema_version, "v1.0"):
        raise HTTPException(status_code=400, detail=f"Incompatible schema version: {request.settings_schema_version}")

    pref = db.query(models.UserPreference).filter(models.UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = models.UserPreference(
            id=uuid.uuid4(),
            user_id=current_user.id
        )
    
    old_val = pref.preferences_json
    pref.preferences_json = request.preferences_json
    pref.settings_schema_version = request.settings_schema_version
    pref.last_migrated = datetime.utcnow()
    pref.migration_required = False
    
    db.add(pref)
    
    audit = models.PreferenceAuditLog(
        id=uuid.uuid4(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        action="Preferences Imported",
        previous_value=old_val,
        new_value=request.preferences_json
    )
    db.add(audit)
    db.commit()
    db.refresh(pref)
    return pref

