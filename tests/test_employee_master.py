import pytest
import uuid

pytestmark = pytest.mark.api

class TestEmployeeMasterAPI:
    def test_create_master_employee_valid_payload(self, client, admin_headers):
        """A complete master employee payload should create successfully."""
        payload = {
            "employee_id": f"EMP-MSTR-{uuid.uuid4().hex[:6].upper()}",
            "first_name": "Test",
            "last_name": "MasterEmployee",
            "email": f"mstr_emp_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "9999988888",
            "is_active": True,
            "is_deleted": False,
        }
        response = client.post("/api/masters/employees/", json=payload, headers=admin_headers)
        assert response.status_code in (200, 201)
        data = response.json()
        assert data.get("first_name") == payload["first_name"]
        assert data.get("employee_id") == payload["employee_id"]

    def test_create_hr_employee_valid_payload(self, client, admin_headers):
        """An HR employee payload should map employee_code to employee_id and save successfully."""
        payload = {
            "employee_code": f"EMP-HR-{uuid.uuid4().hex[:6].upper()}",
            "first_name": "Test",
            "last_name": "HREmployee",
            "email": f"hr_emp_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "9999977777",
            "designation": "Software Engineer",
            "employment_type": "Full-time",
            "status": "ACTIVE",
        }
        # Note the prefix is /api/hr/employees
        response = client.post("/api/hr/employees", json=payload, headers=admin_headers)
        assert response.status_code in (200, 201)
        data = response.json()
        assert data.get("first_name") == payload["first_name"]
        # In HREmployeeResponse, employee_code is mapped from employee_id via property
        assert data.get("employee_code") == payload["employee_code"]
