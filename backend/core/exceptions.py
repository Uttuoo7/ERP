from fastapi import status
from typing import Optional, Any

class ErpException(Exception):
    """Base exception for all system-wide ERP operations."""
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "An internal server error occurred."
    
    def __init__(self, message: Optional[str] = None, detail: Optional[Any] = None):
        super().__init__(message or self.message)
        if message:
            self.message = message
        self.detail = detail

class TenantAccessDenied(ErpException):
    """Exception raised when a user attempts to access a resource belonging to another tenant."""
    status_code: int = status.HTTP_403_FORBIDDEN
    message: str = "Access denied. Resource does not belong to your tenant."

class TenantNotConfigured(ErpException):
    """Exception raised when tenant context cannot be resolved from the request headers or sub-domain."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Invalid or missing tenant configuration headers."

class LedgerImbalanceError(ErpException):
    """Exception raised when a double-entry financial voucher transaction does not balance (Debits != Credits)."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Financial transaction failed. The sum of all Debit entries must equal the sum of all Credit entries."

class StockInsufficiencyError(ErpException):
    """Exception raised during stock issues or reservations when available quantity is below requested quantity."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Insufficient warehouse stock to execute inventory transaction."

class ApprovalHierarchyException(ErpException):
    """Exception raised when an approval routing step fails due to missing roles or incorrect levels."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Workflow routing failed. Approval hierarchy could not resolve the next supervisor step."

class EntityNotFoundException(ErpException):
    """Exception raised when a requested resource is not found in the database or belongs to another tenant."""
    status_code: int = status.HTTP_404_NOT_FOUND
    message: str = "Requested resource not found."

class WorkflowValidationException(ErpException):
    """Exception raised when attempting invalid state transitions inside the workflow engine."""
    status_code: int = status.HTTP_400_BAD_REQUEST
    message: str = "Invalid workflow state transition sequence."
