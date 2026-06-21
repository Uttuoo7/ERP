from typing import Optional

class VersionCompatibilityManager:
    @staticmethod
    def parse_semver(version: str) -> tuple:
        """Parses MAJOR.MINOR.PATCH format. Strips leading 'v' prefix if present."""
        try:
            # Strip leading 'v' or 'V' prefix (e.g. "v1.0" -> "1.0")
            v = version.lstrip('vV')
            parts = v.split('.')
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
            patch = int(parts[2]) if len(parts) > 2 else 0
            return (major, minor, patch)
        except Exception:
            return (0, 0, 0)

    @classmethod
    def is_compatible(cls, current_platform: str, min_platform: str, max_platform: Optional[str] = None) -> bool:
        """Determines if the platform version fits within version range constraint."""
        curr = cls.parse_semver(current_platform)
        min_v = cls.parse_semver(min_platform)
        
        # Check minimum version requirement
        if curr < min_v:
            return False
            
        # Check maximum version requirement
        if max_platform:
            max_v = cls.parse_semver(max_platform)
            # If current version exceeds max, check if it's a major upgrade
            if curr > max_v:
                return False
                
        return True
