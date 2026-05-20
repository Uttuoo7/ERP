import uuid
import logging
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/permissions", response_model=List[str])
def get_user_permissions(
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Returns a simple list of strings representing the active user's permissions.
    """
    role = current_user.role
    perms = dependencies.ROLE_PERMISSIONS.get(role, set())
    # Admins automatically receive all permission sets
    if role in [models.Role.ADMIN, models.Role.SUPER_ADMIN]:
        # Merge all permissions in matrix
        all_perms = set()
        for p_set in dependencies.ROLE_PERMISSIONS.values():
            all_perms.update(p_set)
        return list(all_perms)
    return list(perms)

@router.get("/matrix", response_model=Dict[str, List[str]])
def get_role_permissions_matrix(
    current_user: models.User = Depends(dependencies.require_permission("rbac:manage"))
):
    """
    Returns the complete static role-permission configurations.
    """
    return {role.value: list(perms) for role, perms in dependencies.ROLE_PERMISSIONS.items()}

@router.get("/users", response_model=List[dict])
def get_users_list(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("rbac:manage"))
):
    """
    Returns a list of all active users with their assigned roles.
    """
    users = db.query(models.User).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]

@router.post("/assign", status_code=status.HTTP_200_OK)
def assign_user_role(
    payload: schemas.UserRoleAssignmentRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("rbac:manage"))
):
    """
    Super Admin Action:
    Mutates a user's assigned role and logs the audit event.
    """
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        new_role = models.Role(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role type specified.")

    old_role = user.role
    user.role = new_role

    # Audit Role mutation
    log = models.AuditSecurityLog(
        user_id=current_user.id,
        action="ROLE_MUTATION",
        details=f"Mutated role of user {user.username} (ID: {user.id}) from {old_role.value} to {new_role.value}"
    )
    db.add(log)
    db.commit()

    logger.info(f"User role mutation complete: {user.username} is now {new_role.value}")
    return {"message": "Role assignment mutated successfully."}

@router.get("/audit-logs", response_model=List[schemas.AuditSecurityLogResponse])
def get_security_audit_logs(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("rbac:audit"))
):
    """
    Returns failed endpoint authentication logs and role updates chronologically.
    """
    return db.query(models.AuditSecurityLog).order_by(models.AuditSecurityLog.timestamp.desc()).all()
