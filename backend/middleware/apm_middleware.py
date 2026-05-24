import time
import logging
import traceback
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import ApiRequestLog
from ..logging_config import user_id_var

logger = logging.getLogger(__name__)

class APMMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        error_details = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"APM captured exception: {str(e)}")
            raise e
        finally:
            process_time = (time.time() - start_time) * 1000
            
            # Avoid logging OPTIONS or static files if necessary
            if request.method != "OPTIONS" and "/api/" in request.url.path:
                try:
                    db = SessionLocal()
                    
                    user_id = user_id_var.get()
                    
                    log_entry = ApiRequestLog(
                        endpoint=request.url.path,
                        method=request.method,
                        status_code=status_code,
                        response_time_ms=process_time,
                        user_id=user_id,
                        error_details=error_details
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception as db_err:
                    logger.error(f"Failed to write APM log: {db_err}")
                finally:
                    db.close()
