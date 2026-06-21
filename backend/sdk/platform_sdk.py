import uuid
from typing import Optional
from sqlalchemy.orm import Session
from .. import models

class EnterprisePluginSDK:
    @staticmethod
    def run_in_transaction(db: Session, tenant_id: uuid.UUID, operation_func):
        """Wraps an operation in a tenant-isolated database transaction."""
        # Enforce tenant context mapping
        db.begin_nested()
        try:
            result = operation_func(db, tenant_id)
            db.commit()
            return result
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def check_feature_flag(db: Session, tenant_id: uuid.UUID, feature_key: str, env: str = "Production") -> bool:
        """Determines if a feature flag is enabled for the given tenant/environment."""
        # Find tenant override
        flag = db.query(models.FeatureFlag).filter(
            models.FeatureFlag.feature_key == feature_key,
            models.FeatureFlag.tenant_id == tenant_id,
            models.FeatureFlag.environment == env
        ).first()
        if not flag:
            # Find global default
            flag = db.query(models.FeatureFlag).filter(
                models.FeatureFlag.feature_key == feature_key,
                models.FeatureFlag.tenant_id == None,
                models.FeatureFlag.environment == env
            ).first()
        
        if not flag:
            return False
            
        if not flag.enabled:
            return False
            
        # Rollout percentage logic using a stable hash of tenant_id
        if flag.rollout_percentage < 100:
            val = hash(f"{tenant_id}-{feature_key}") % 100
            return val < flag.rollout_percentage
            
        return True

    @staticmethod
    def log_preference_change(db: Session, user_id: uuid.UUID, tenant_id: uuid.UUID, action: str, prev_val: Optional[str], new_val: Optional[str], ip_address: Optional[str] = None, client_agent: Optional[str] = None):
        """Creates an audit entry for preference changes."""
        audit_log = models.PreferenceAuditLog(
            id=uuid.uuid4(),
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            previous_value=prev_val,
            new_value=new_val,
            ip_address=ip_address,
            client_agent=client_agent
        )
        db.add(audit_log)
        db.commit()
