from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
from typing import List
from . import database, schemas, models
from .dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/workspaces", tags=["Workspace Governance"])

@router.get("", response_model=List[schemas.WorkspaceResponse])
def list_workspaces(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Lists workspaces accessible to the user based on type and permissions."""
    # Find personal workspaces
    personal_ws = db.query(models.Workspace).filter(
        models.Workspace.tenant_id == current_user.tenant_id,
        models.Workspace.type == "PERSONAL",
        models.Workspace.owner_id == current_user.id
    ).all()

    # Find shared, department or system workspaces
    other_ws = db.query(models.Workspace).filter(
        models.Workspace.tenant_id == current_user.tenant_id,
        models.Workspace.type.in_(["SHARED", "DEPARTMENT", "SYSTEM"])
    ).all()

    accessible = list(personal_ws)
    user_role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.name == current_user.role.value).first()
    
    for ws in other_ws:
        if ws.type == "SYSTEM":
            # Everyone has read access to SYSTEM workspaces
            accessible.append(ws)
        elif ws.type == "DEPARTMENT" and ws.department_id == current_user.branch_id: # Use branch_id as simple department mapping
            accessible.append(ws)
        elif user_role_def:
            # Check explicit role-based permissions mapping
            permission = db.query(models.WorkspacePermission).filter(
                models.WorkspacePermission.workspace_id == ws.id,
                models.WorkspacePermission.role_id == user_role_def.id
            ).first()
            if permission and permission.can_view:
                accessible.append(ws)

    # Attach permissions details to response
    response_list = []
    for ws in accessible:
        permissions_list = []
        perms = db.query(models.WorkspacePermission).filter(models.WorkspacePermission.workspace_id == ws.id).all()
        for p in perms:
            role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.id == p.role_id).first()
            permissions_list.append(schemas.WorkspacePermissionResponse(
                id=p.id,
                workspace_id=p.workspace_id,
                role_id=p.role_id,
                role_name=role_def.name if role_def else "Unknown",
                can_view=p.can_view,
                can_edit=p.can_edit,
                can_duplicate=p.can_duplicate,
                can_delete=p.can_delete,
                can_publish=p.can_publish
            ))
        
        response_list.append(schemas.WorkspaceResponse(
            id=ws.id,
            tenant_id=ws.tenant_id,
            owner_id=ws.owner_id,
            name=ws.name,
            type=ws.type,
            department_id=ws.department_id,
            layout_json=ws.layout_json,
            created_at=ws.created_at,
            updated_at=ws.updated_at,
            permissions=permissions_list
        ))
        
    return response_list

@router.post("", response_model=schemas.WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(request: schemas.WorkspaceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Creates a new workspace and sets permissions."""
    ws = models.Workspace(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        owner_id=current_user.id if request.type == "PERSONAL" else None,
        name=request.name,
        type=request.type,
        department_id=request.department_id,
        layout_json=request.layout_json
    )
    db.add(ws)
    db.flush()

    # Create permission entries
    permission_responses = []
    for perm_req in request.permissions:
        role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.id == perm_req.role_id).first()
        p = models.WorkspacePermission(
            id=uuid.uuid4(),
            workspace_id=ws.id,
            role_id=perm_req.role_id,
            can_view=perm_req.can_view,
            can_edit=perm_req.can_edit,
            can_duplicate=perm_req.can_duplicate,
            can_delete=perm_req.can_delete,
            can_publish=perm_req.can_publish
        )
        db.add(p)
        db.flush()
        permission_responses.append(schemas.WorkspacePermissionResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            role_id=p.role_id,
            role_name=role_def.name if role_def else "Unknown",
            can_view=p.can_view,
            can_edit=p.can_edit,
            can_duplicate=p.can_duplicate,
            can_delete=p.can_delete,
            can_publish=p.can_publish
        ))
        
    db.commit()
    
    return schemas.WorkspaceResponse(
        id=ws.id,
        tenant_id=ws.tenant_id,
        owner_id=ws.owner_id,
        name=ws.name,
        type=ws.type,
        department_id=ws.department_id,
        layout_json=ws.layout_json,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
        permissions=permission_responses
    )

@router.put("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(workspace_id: uuid.UUID, request: schemas.WorkspaceUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Updates an existing workspace layout if authorized."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Authorization Check
    authorized = False
    if ws.type == "PERSONAL" and ws.owner_id == current_user.id:
        authorized = True
    elif ws.type == "SYSTEM" and current_user.role in (models.Role.ADMIN, models.Role.SUPER_ADMIN):
        authorized = True
    else:
        # Check database role permissions
        user_role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.name == current_user.role.value).first()
        if user_role_def:
            perm = db.query(models.WorkspacePermission).filter(
                models.WorkspacePermission.workspace_id == ws.id,
                models.WorkspacePermission.role_id == user_role_def.id
            ).first()
            if perm and perm.can_edit:
                authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized to edit this workspace")

    if request.name:
        ws.name = request.name
    if request.layout_json is not None:
        ws.layout_json = request.layout_json
    if request.type:
        ws.type = request.type
    if request.department_id:
        ws.department_id = request.department_id

    db.add(ws)
    db.commit()
    db.refresh(ws)

    # Get permissions lists
    permissions_list = []
    perms = db.query(models.WorkspacePermission).filter(models.WorkspacePermission.workspace_id == ws.id).all()
    for p in perms:
        role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.id == p.role_id).first()
        permissions_list.append(schemas.WorkspacePermissionResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            role_id=p.role_id,
            role_name=role_def.name if role_def else "Unknown",
            can_view=p.can_view,
            can_edit=p.can_edit,
            can_duplicate=p.can_duplicate,
            can_delete=p.can_delete,
            can_publish=p.can_publish
        ))

    return schemas.WorkspaceResponse(
        id=ws.id,
        tenant_id=ws.tenant_id,
        owner_id=ws.owner_id,
        name=ws.name,
        type=ws.type,
        department_id=ws.department_id,
        layout_json=ws.layout_json,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
        permissions=permissions_list
    )

@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(workspace_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Deletes a workspace layout."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    authorized = False
    if ws.type == "PERSONAL" and ws.owner_id == current_user.id:
        authorized = True
    elif ws.type == "SYSTEM" and current_user.role in (models.Role.ADMIN, models.Role.SUPER_ADMIN):
        authorized = True
    else:
        user_role_def = db.query(models.RoleDefinition).filter(models.RoleDefinition.name == current_user.role.value).first()
        if user_role_def:
            perm = db.query(models.WorkspacePermission).filter(
                models.WorkspacePermission.workspace_id == ws.id,
                models.WorkspacePermission.role_id == user_role_def.id
            ).first()
            if perm and perm.can_delete:
                authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized to delete this workspace")

    db.delete(ws)
    db.commit()

@router.post("/{workspace_id}/publish", response_model=schemas.WorkspaceResponse)
def publish_workspace(workspace_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(require_role([models.Role.SUPER_ADMIN, models.Role.ADMIN]))):
    """Publishes a workspace configuration as a SYSTEM workspace template."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    system_ws = models.Workspace(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        owner_id=None,
        name=f"[SYSTEM] {ws.name}",
        type="SYSTEM",
        layout_json=ws.layout_json
    )
    db.add(system_ws)
    db.flush()

    # Replicate default viewing permission for all roles
    roles = db.query(models.RoleDefinition).all()
    permissions_list = []
    for r in roles:
        p = models.WorkspacePermission(
            id=uuid.uuid4(),
            workspace_id=system_ws.id,
            role_id=r.id,
            can_view=True,
            can_edit=False,
            can_duplicate=True,
            can_delete=False,
            can_publish=False
        )
        db.add(p)
        db.flush()
        permissions_list.append(schemas.WorkspacePermissionResponse(
            id=p.id,
            workspace_id=p.workspace_id,
            role_id=p.role_id,
            role_name=r.name,
            can_view=True,
            can_edit=False,
            can_duplicate=True,
            can_delete=False,
            can_publish=False
        ))

    db.commit()

    return schemas.WorkspaceResponse(
        id=system_ws.id,
        tenant_id=system_ws.tenant_id,
        owner_id=None,
        name=system_ws.name,
        type="SYSTEM",
        department_id=None,
        layout_json=system_ws.layout_json,
        created_at=system_ws.created_at,
        updated_at=system_ws.updated_at,
        permissions=permissions_list
    )
