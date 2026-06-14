"""
tests/conftest.py
Global pytest configuration.
Imports all fixture modules so they are automatically discovered by pytest.
"""
import os
import sys

# Mark as testing environment BEFORE any backend imports to prevent
# module-level side effects (DB seeding, etc.)
os.environ["TESTING"] = "1"

# Ensure project root is on the Python path so `backend` package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load test environment variables BEFORE importing the app
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.test"))

# ── Re-export all fixtures ──────────────────────────────────────────────────
# pytest discovers fixtures from here automatically
from tests.fixtures.db import (        # noqa: F401
    test_engine,
    test_session_factory,
    db_session,
)
from tests.fixtures.client import client  # noqa: F401
from tests.fixtures.auth import (         # noqa: F401
    admin_headers,
    buyer_headers,
    warehouse_headers,
    finance_headers,
    procurement_manager_headers,
    finance_manager_headers,
    auditor_headers,
)

# Apply runtime monkeypatch to fix python 3.14/SQLAlchemy evaluation environment bug
from sqlalchemy.dialects.sqlite.base import SQLiteExecutionContext
from sqlalchemy.engine.default import DefaultExecutionContext

for ctx_class in (SQLiteExecutionContext, DefaultExecutionContext):
    if hasattr(ctx_class, "get_result_proxy"):
        original_get_result_proxy = getattr(ctx_class, "get_result_proxy")
        def make_safe_getter(orig_method):
            def safe_get_result_proxy(self):
                if not hasattr(self, "adhoc_result"):
                    self.adhoc_result = getattr(self, "result", None)
                return orig_method(self)
            return safe_get_result_proxy
        setattr(ctx_class, "get_result_proxy", make_safe_getter(original_get_result_proxy))

