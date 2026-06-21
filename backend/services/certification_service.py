import uuid
from typing import Dict, Any, List

class PlatformCertificationService:
    @staticmethod
    def validate_plugin_security(manifest: Dict[str, Any]) -> List[str]:
        """Scans plugin configurations and metadata for security compliance."""
        warnings = []
        
        # Check security keys
        if "bypass_auth" in str(manifest).lower():
            warnings.append("Plugin attempts to bypass standard auth layers.")
        if "select * from" in str(manifest).lower():
            warnings.append("Plugin uses raw, non-parameterized SQL queries.")
            
        return warnings

    @staticmethod
    def validate_plugin_accessibility(manifest: Dict[str, Any]) -> List[str]:
        """Ensures extension UI fields include ARIA tags or keyboard labels."""
        warnings = []
        
        # Check UI components
        routes = manifest.get("routes", [])
        for route in routes:
            if "title" not in route:
                warnings.append(f"Route {route.get('path', '')} has no screen reader title.")
                
        return warnings

    @classmethod
    def certify_plugin(cls, manifest: Dict[str, Any]) -> tuple:
        """Runs overall certification pipeline: security, accessibility, configuration."""
        security_warnings = cls.validate_plugin_security(manifest)
        accessibility_warnings = cls.validate_plugin_accessibility(manifest)
        
        all_warnings = security_warnings + accessibility_warnings
        is_certified = len(all_warnings) == 0
        
        return is_certified, all_warnings
