import logging
import os
import sys
from pythonjsonlogger import jsonlogger
from asgi_correlation_id.context import correlation_id
import contextvars

# Context variables for our custom log fields
tenant_id_var = contextvars.ContextVar('tenant_id', default=None)
user_id_var = contextvars.ContextVar('user_id', default=None)

class CorrelationIdFilter(logging.Filter):
    """
    Injects correlation_id, tenant_id, and user_id into the log record.
    """
    def filter(self, record):
        record.correlation_id = correlation_id.get()
        record.tenant_id = tenant_id_var.get()
        record.user_id = user_id_var.get()
        return True

def setup_logging():
    logger = logging.getLogger()
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logger.setLevel(log_level)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(CorrelationIdFilter())

    # In production, use JSON logging. In development, use readable text.
    if os.environ.get("JSON_LOGS", "false").lower() == "true":
        formatter = jsonlogger.JsonFormatter(
            '%(asctime)s %(levelname)s %(name)s %(correlation_id)s %(tenant_id)s %(user_id)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s [%(name)s] [CorrID: %(correlation_id)s] [Tenant: %(tenant_id)s] [User: %(user_id)s] - %(message)s'
        )

    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)

    return logger

# Initialize logging when module is imported
logger = setup_logging()
