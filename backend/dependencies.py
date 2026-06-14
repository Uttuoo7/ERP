import uuid
import logging
from typing import List, Set
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models, database, auth_utils

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Unified Role-to-Permission sets
ROLE_PERMISSIONS = {
    models.Role.SUPER_ADMIN: {
        "pr:view", "pr:create", "pr:edit", "pr:approve",
        "rfq:view", "rfq:create", "rfq:invite", "rfq:compare", "rfq:select",
        "po:view", "po:create", "po:edit", "po:approve", "po:amend",
        "grn:view", "grn:create", "grn:qc",
        "invoice:view", "invoice:create", "invoice:post", "invoice:resolve",
        "finance:liabilities", "finance:payments", "tally:sync",
        "rbac:manage", "rbac:audit"
    },
    models.Role.ADMIN: {
        "pr:view", "pr:create", "pr:edit", "pr:approve",
        "rfq:view", "rfq:create", "rfq:invite", "rfq:compare", "rfq:select",
        "po:view", "po:create", "po:edit", "po:approve", "po:amend",
        "grn:view", "grn:create", "grn:qc",
        "invoice:view", "invoice:create", "invoice:post", "invoice:resolve",
        "finance:liabilities", "finance:payments", "tally:sync",
        "rbac:manage", "rbac:audit"
    },
    models.Role.PROCUREMENT_MANAGER: {
        "pr:view", "pr:create", "pr:edit", "pr:approve",
        "rfq:view", "rfq:create", "rfq:invite", "rfq:compare", "rfq:select",
        "po:view", "po:create", "po:edit", "po:approve", "po:amend",
        "grn:view"
    },
    models.Role.BUYER: {
        "pr:view", "pr:create", "pr:edit",
        "rfq:view", "rfq:create", "rfq:invite",
        "po:view", "po:create"
    },
    models.Role.FINANCE_MANAGER: {
        "po:view",
        "grn:view",
        "invoice:view", "invoice:create", "invoice:post", "invoice:resolve",
        "finance:liabilities", "finance:payments", "tally:sync"
    },
    models.Role.FINANCE: {
        "po:view",
        "invoice:view", "invoice:create", "invoice:post",
        "finance:liabilities", "finance:payments"
    },
    models.Role.WAREHOUSE_MANAGER: {
        "po:view",
        "grn:view", "grn:create", "grn:qc",
        "inventory:view", "inventory:adjust"
    },
    models.Role.WAREHOUSE: {
        "po:view",
        "grn:view", "grn:create",
        "inventory:view"
    },
    models.Role.EMPLOYEE: {
        "pr:view", "pr:create",
        "inventory:view"
    },
    models.Role.AUDITOR: {
        "pr:view", "rfq:view", "po:view", "grn:view", "invoice:view", "finance:liabilities"
    },
    models.Role.VENDOR: {
        "rfq:view", "po:view"
    }
}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = auth_utils.decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception
        
    # Bypass tenant filter temporarily to resolve the authentication context safely
    database.set_bypass_tenant_filter(True)
    try:
        user = db.query(models.User).filter(models.User.id == user_uuid).first()
    finally:
        database.set_bypass_tenant_filter(False)
        
    if user is None or not user.is_active:
        raise credentials_exception
        
    # Verify JWT claim isolation matches the resolved User profile
    token_tenant = payload.get("tenant_id")
    if token_tenant and str(user.tenant_id) != token_tenant:
        raise credentials_exception
        
    # Dynamically bind resolved tenant context to active thread/context session
    database.set_current_tenant_id(user.tenant_id)
    
    return user

def require_role(allowed_roles: List[models.Role]):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in allowed_roles and current_user.role != models.Role.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Operation not permitted. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker

def require_permission(permission: str):
    """
    Dynamic Permissions validation engine decorator:
    Checks if active user role carries the specified permission.
    Logs failed security access blocks in the security audit queue.
    """
    def permission_checker(
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(database.get_db)
    ):
        user_role = current_user.role
        perms = ROLE_PERMISSIONS.get(user_role, set())
        
        if permission not in perms and user_role not in [models.Role.ADMIN, models.Role.SUPER_ADMIN]:
            # Log failed attempt in security audit (best-effort, non-blocking)
            try:
                log = models.AuditSecurityLog(
                    user_id=current_user.id,
                    action="ACCESS_BLOCKED",
                    details=f"User attempted to invoke endpoint requiring permission {permission} with role {user_role.value}"
                )
                db.add(log)
                db.commit()
            except Exception:
                db.rollback()
                logger.warning("Failed to write security audit log for ACCESS_BLOCKED event")
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied. Operation requires permission: {permission}"
            )
        return current_user
    return permission_checker

def require_vendor(current_user: models.User = Depends(get_current_user)):
    """
    Validates that the authenticated user is a Vendor and extracts their vendor_id.
    """
    if current_user.role != models.Role.VENDOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied. This endpoint is strictly for Vendor use."
        )
    if not current_user.vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied. User is not linked to a Vendor profile."
        )
    return current_user

def get_tenant_id(current_user: models.User = Depends(get_current_user)) -> str:
    """
    Dependency to resolve the active tenant ID from the authenticated user.
    """
    return str(current_user.tenant_id) if current_user.tenant_id else None


# Reusable inventory dependencies
require_revaluation_user = require_role([
    models.Role.ADMIN,
    models.Role.SUPER_ADMIN,
    models.Role.FINANCE_MANAGER,
    models.Role.FINANCE
])

require_snapshot_user = require_role([
    models.Role.ADMIN,
    models.Role.SUPER_ADMIN,
    models.Role.FINANCE_MANAGER,
    models.Role.WAREHOUSE_MANAGER
])

require_inventory_admin_user = require_role([
    models.Role.ADMIN,
    models.Role.SUPER_ADMIN,
    models.Role.FINANCE_MANAGER
])

