import pytest
import uuid
import json
from backend import models, schemas
from backend.sdk.platform_sdk import EnterprisePluginSDK
from backend.services.compatibility_manager import VersionCompatibilityManager
from backend.services.certification_service import PlatformCertificationService

@pytest.mark.api
def test_compatibility_manager():
    # Test valid versions
    assert VersionCompatibilityManager.is_compatible("1.0.0", "1.0.0") is True
    assert VersionCompatibilityManager.is_compatible("1.1.0", "1.0.0") is True
    # Test invalid version limits
    assert VersionCompatibilityManager.is_compatible("0.9.0", "1.0.0") is False
    assert VersionCompatibilityManager.is_compatible("2.0.0", "1.0.0", "1.5.0") is False

@pytest.mark.api
def test_certification_service():
    # Safe manifest
    safe_manifest = {
        "routes": [{"path": "/hr", "title": "Human Resources"}]
    }
    is_certified, warnings = PlatformCertificationService.certify_plugin(safe_manifest)
    assert is_certified is True
    assert len(warnings) == 0

    # Unsafe manifest
    unsafe_manifest = {
        "routes": [{"path": "/hr"}],  # missing title (accessibility)
        "actions": ["bypass_auth"]    # security trigger
    }
    is_certified, warnings = PlatformCertificationService.certify_plugin(unsafe_manifest)
    assert is_certified is False
    assert len(warnings) > 0

@pytest.mark.api
def test_feature_flags_endpoints(client, admin_headers):
    # 1. Create a feature flag
    flag_data = {
        "feature_key": "APS_TEST",
        "enabled": True,
        "rollout_percentage": 100,
        "environment": "Production",
        "minimum_license": "enterprise"
    }
    res = client.post("/api/saas/features", json=flag_data, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["feature_key"] == "APS_TEST"
    assert data["enabled"] is True

    # 2. Query feature flags
    res = client.get("/api/saas/features?env=Production", headers=admin_headers)
    assert res.status_code == 200
    assert any(x["feature_key"] == "APS_TEST" for x in res.json())

@pytest.mark.api
def test_plugin_state_endpoints(client, admin_headers):
    # 1. Update plugin state
    state_data = {
        "enabled": True,
        "license_level": "enterprise",
        "configuration_json": '{"setting_key": "val"}',
        "installed_version": "1.0.5"
    }
    res = client.put("/api/saas/plugins/state/hr_module", json=state_data, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["plugin_key"] == "hr_module"
    assert data["enabled"] is True
    assert data["installed_version"] == "1.0.5"

    # 2. Run migrations hook
    res = client.post("/api/saas/plugins/migrate/hr_module?action=onInstall", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Plugin migration completed successfully"

@pytest.mark.api
def test_workspace_governance_endpoints(client, admin_headers, db_session):
    # Ensure roles are seeded in testing DB
    role_def = db_session.query(models.RoleDefinition).filter(models.RoleDefinition.name == "ADMIN").first()
    if not role_def:
        role_def = models.RoleDefinition(id=uuid.uuid4(), name="ADMIN", description="Admin role")
        db_session.add(role_def)
        db_session.commit()

    # 1. Create a workspace
    ws_data = {
        "name": "Procurement Shared Layout",
        "type": "SHARED",
        "layout_json": '{"widgets": []}',
        "permissions": [
            {
                "workspace_id": "00000000-0000-0000-0000-000000000000",  # dummy placeholder
                "role_id": str(role_def.id),
                "can_view": True,
                "can_edit": True,
                "can_duplicate": True,
                "can_delete": False,
                "can_publish": False
            }
        ]
    }
    res = client.post("/api/workspaces", json=ws_data, headers=admin_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Procurement Shared Layout"
    assert len(data["permissions"]) == 1
    assert data["permissions"][0]["can_edit"] is True
    ws_id = data["id"]

    # 2. Query workspaces list
    res = client.get("/api/workspaces", headers=admin_headers)
    assert res.status_code == 200
    assert any(x["id"] == ws_id for x in res.json())

    # 3. Publish template to system workspace
    res = client.post(f"/api/workspaces/{ws_id}/publish", headers=admin_headers)
    assert res.status_code == 200
    assert "[SYSTEM]" in res.json()["name"]

@pytest.mark.api
def test_preferences_import_export_endpoints(client, admin_headers):
    # 1. Fetch default preferences
    res = client.get("/api/auth/preferences", headers=admin_headers)
    assert res.status_code == 200
    pref_data = res.json()
    assert pref_data["settings_schema_version"] == "v1.0"

    # 2. Update preferences
    update_data = {
        "preferences_json": '{"appearance": {"theme": "dark"}}'
    }
    res = client.put("/api/auth/preferences", json=update_data, headers=admin_headers)
    assert res.status_code == 200
    assert "dark" in res.json()["preferences_json"]

    # 3. Export preferences manifest
    res = client.get("/api/auth/preferences/export", headers=admin_headers)
    assert res.status_code == 200
    manifest = res.json()
    assert manifest["settings_schema_version"] == "v1.0"

    # 4. Import preferences manifest
    res = client.post("/api/auth/preferences/import", json=manifest, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["settings_schema_version"] == "v1.0"

    # 5. Invalid import schema version mismatch
    invalid_manifest = {
        "settings_schema_version": "v0.5",
        "preferences_json": "{}"
    }
    res = client.post("/api/auth/preferences/import", json=invalid_manifest, headers=admin_headers)
    assert res.status_code == 400
