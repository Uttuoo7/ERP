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
