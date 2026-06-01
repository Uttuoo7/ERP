import uuid
import logging
from sqlalchemy.orm import Session
from .. import models, schemas
from passlib.context import CryptContext

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def provision_new_tenant(db: Session, request: schemas.SaaSOnboardingRequest) -> models.Tenant:
    logger.info(f"Starting SaaS Onboarding for {request.company_name}")
    
    # 1. Create Tenant
    new_tenant = models.Tenant(
        name=request.company_name,
        domain=request.domain,
        subscription_plan="STARTER"
    )
    db.add(new_tenant)
    db.flush() # Get the generated tenant ID
    
    # 2. Create Tenant Config
    config = models.TenantConfig(
        tenant_uuid=new_tenant.id,
        tenant_id=new_tenant.id,
        theme_color="#4f46e5"
    )
    db.add(config)
    
    # 3. Create Company
    company = models.Company(
        tenant_uuid=new_tenant.id,
        tenant_id=new_tenant.id,
        name=request.company_name,
        base_currency="USD"
    )
    db.add(company)
    db.flush()
    
    # 4. Create Headquarter Branch
    branch = models.Branch(
        company_id=company.id,
        tenant_id=new_tenant.id,
        name="HQ",
        is_headquarters=True
    )
    db.add(branch)
    db.flush()
    
    # 5. Create Admin User
    hashed_pwd = pwd_context.hash(request.admin_password)
    admin_user = models.User(
        tenant_id=new_tenant.id,
        company_id=company.id,
        branch_id=branch.id,
        username=request.admin_username,
        email=request.admin_email,
        hashed_password=hashed_pwd,
        role=models.Role.SUPER_ADMIN
    )
    db.add(admin_user)
    
    # 6. Commit the entire transaction
    try:
        db.commit()
        db.refresh(new_tenant)
        logger.info(f"Successfully provisioned Tenant: {new_tenant.id}")
        return new_tenant
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to provision SaaS tenant: {e}")
        raise
