import os
from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Ensure .env is loaded
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(env_path)

raw_db_url = os.getenv("DATABASE_URL", "").strip()
if not raw_db_url:
    raw_db_url = "postgresql://erp_user:erp_password@localhost:5432/p2p_erp"
elif raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

class DatabaseSettings(BaseModel):
    url: str = Field(default=raw_db_url)
    pool_size: int = Field(default=int(os.getenv("DATABASE_POOL_SIZE", "20")))
    max_overflow: int = Field(default=int(os.getenv("DATABASE_MAX_OVERFLOW", "0")))
    pool_pre_ping: bool = Field(default=True)

class SecuritySettings(BaseModel):
    jwt_secret: str = Field(default=os.getenv("JWT_SECRET", "super_secret_p2p_erp_key_for_jwt_tokens"))
    secret_key: str = Field(default=os.getenv("SECRET_KEY", "prod_secret_key_change_me_in_env"))
    jwt_algorithm: str = Field(default=os.getenv("JWT_ALGORITHM", "HS256"))
    access_token_expire_minutes: int = Field(default=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")))
    refresh_token_expire_days: int = Field(default=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")))

class ServerSettings(BaseModel):
    port: int = Field(default=int(os.getenv("PORT", "8000")))
    environment: str = Field(default=os.getenv("ENVIRONMENT", "production"))
    cors_origins: List[str] = Field(
        default=[
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
            if origin.strip()
        ]
    )

class RedisSettings(BaseModel):
    url: str = Field(default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    enabled: bool = Field(default=os.getenv("REDIS_ENABLED", "False").lower() in ("true", "1", "yes"))

class Settings(BaseModel):
    db: DatabaseSettings = DatabaseSettings()
    security: SecuritySettings = SecuritySettings()
    server: ServerSettings = ServerSettings()
    redis: RedisSettings = RedisSettings()

settings = Settings()
