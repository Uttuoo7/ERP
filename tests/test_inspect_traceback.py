import pytest
from sqlalchemy.dialects.sqlite.base import SQLiteExecutionContext
from tests.test_mfg_mrp_integration import test_mrp_transfer_logic_execution

# Apply the runtime monkeypatch to fix the sandbox evaluation bug on Python 3.14!
if hasattr(SQLiteExecutionContext, "get_result_proxy"):
    original_get_result_proxy = SQLiteExecutionContext.get_result_proxy
    def safe_get_result_proxy(self):
        if not hasattr(self, "adhoc_result"):
            self.adhoc_result = getattr(self, "result", None)
        return original_get_result_proxy(self)
    SQLiteExecutionContext.get_result_proxy = safe_get_result_proxy
    print("APPLIED MONKEYPATCH SUCCESS!")

def test_repro_success(db_session):
    # Run the test that failed previously
    test_mrp_transfer_logic_execution(db_session)
    print("TEST PASSED SUCCESSFULLY WITH MONKEYPATCH!")
