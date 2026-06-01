import os
from celery import Celery
import time

# Configure Celery
celery_app = Celery(
    "erp_worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task
def send_email_notification(to_email: str, subject: str, body: str):
    # Mock sending email
    time.sleep(1) # Simulate network delay
    print(f"Email sent to {to_email}: {subject}")
    return {"status": "success", "to": to_email}

@celery_app.task
def generate_export_report(report_type: str, user_id: str):
    # Mock generating export report
    time.sleep(5) # Simulate heavy lifting
    print(f"Export {report_type} completed for {user_id}")
    return {"status": "success", "report_type": report_type, "url": f"/downloads/{report_type}_export.xlsx"}

@celery_app.task
def run_mrp_scheduled_task():
    # Mock MRP run
    print("Running scheduled MRP tasks...")
    time.sleep(2)
    return {"status": "success"}


@celery_app.task
def generate_nightly_bi_snapshots():
    print('Generating nightly BI Analytics Snapshots for Finance, Inventory, Mfg, HR')
    time.sleep(3)
    return {'status': 'success'}

@celery_app.task
def run_anomaly_detection_scan():
    print('Scanning ERP for anomalies via ML services')
    time.sleep(4)
    return {'status': 'success', 'anomalies_found': 1}

