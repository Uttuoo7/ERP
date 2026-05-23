import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from backend.database import set_current_tenant_id, SYSTEM_DEFAULT_TENANT_UUID
from backend.auth_utils import decode_token

logger = logging.getLogger(__name__)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware that intercepts incoming requests and extracts the active Tenant ID.
    Supports resolving tenant contexts from:
      1. 'X-Tenant-ID' headers (for direct system integration/B2B callers)
      2. 'Authorization: Bearer <JWT>' (by decoding the custom tenant claim in token payload)
      3. Query Parameters '?tenant_id=UUID' (for analytics exports/download hooks)
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Initialize default tenant context
        tenant_id = SYSTEM_DEFAULT_TENANT_UUID
        
        # 2. Skip tenant checking for system health / public routes
        path = request.url.path
        if path.startswith("/api/health") or path.startswith("/docs") or path.startswith("/openapi.json"):
            set_current_tenant_id(tenant_id)
            return await call_next(request)
            
        # 3. Check X-Tenant-ID Header first
        header_tenant = request.headers.get("X-Tenant-ID")
        if header_tenant:
            try:
                tenant_id = uuid.UUID(header_tenant)
            except ValueError:
                logger.warning(f"Malformed X-Tenant-ID header ignored: '{header_tenant}'")
                
        # 4. Fallback: Parse query parameters
        elif "tenant_id" in request.query_params:
            query_tenant = request.query_params.get("tenant_id")
            try:
                tenant_id = uuid.UUID(query_tenant)
            except ValueError:
                pass
                
        # 5. Fallback: Parse JWT claims (Authorization Header)
        else:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                payload = decode_token(token)
                if payload and "tenant_id" in payload:
                    try:
                        tenant_id = uuid.UUID(payload["tenant_id"])
                    except ValueError:
                        pass
        
        # 6. Bind the resolved tenant ID to the active thread context
        set_current_tenant_id(tenant_id)
        
        # 7. Execute request downstream
        response: Response = await call_next(request)
        
        # 8. Append dynamic Tenant-ID headers in HTTP response for tracing verification
        response.headers["X-Tenant-ID"] = str(tenant_id)
        return response
