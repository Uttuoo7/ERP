import os
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Simulating S3 Bucket
STORAGE_BUCKET = "uploads/enterprise_vault"

def upload_to_storage(file_bytes: bytes, document_type: str, reference_id: str) -> str:
    """
    Simulates uploading a file to an S3 bucket.
    Returns the 's3_key'.
    """
    if not os.path.exists(STORAGE_BUCKET):
        os.makedirs(STORAGE_BUCKET)
        
    s3_key = f"{document_type}/{reference_id}/{uuid.uuid4()}.pdf"
    
    physical_path = os.path.join(STORAGE_BUCKET, s3_key.replace("/", "_"))
    
    with open(physical_path, "wb") as f:
        f.write(file_bytes)
        
    logger.info(f"Uploaded {len(file_bytes)} bytes to {s3_key}")
    return s3_key

def generate_presigned_url(s3_key: str, expiry_minutes: int = 15) -> str:
    """
    Simulates generating a temporary pre-signed URL.
    In reality this would call boto3.client('s3').generate_presigned_url(...)
    """
    # For our local simulation, we'll return a specially crafted API route that serves the file
    # We will build a generic /api/documents/download?key=... route for this
    
    encoded_key = s3_key.replace("/", "_")
    
    # Normally this URL contains a cryptographic signature. We'll mock it.
    mock_signature = uuid.uuid4().hex
    
    return f"/api/documents/vault/{encoded_key}?sig={mock_signature}&expires={expiry_minutes}"
