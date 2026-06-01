"""
backend/limiter.py
Standalone rate limiter instance to prevent circular imports.
Both main.py and auth_router.py can import limiter from here.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
