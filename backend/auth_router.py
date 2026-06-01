from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas, database, auth_utils, dependencies

router = APIRouter()

from .limiter import limiter

@router.post("/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login(request: Request, login_data: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
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

def seed_users(db: Session):
    roles = {
        "admin": models.Role.ADMIN,
        "buyer": models.Role.BUYER,
        "warehouse": models.Role.WAREHOUSE,
        "finance": models.Role.FINANCE
    }
    for username, role in roles.items():
        email = f"{username}@example.com"
        if not db.query(models.User).filter(models.User.email == email).first():
            user = models.User(
                username=username,
                email=email,
                hashed_password=auth_utils.get_password_hash("password"),
                role=role
            )
            db.add(user)
    db.commit()
