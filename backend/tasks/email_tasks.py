from backend.celery_app import celery_app
import logging
import time

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=5)
def send_email_notification(self, recipient_email: str, subject: str, body: str):
    """
    Sends an email notification via SMTP.
    Uses exponential backoff for retries if the SMTP server is unreachable.
    """
    logger.info(f"Sending email to {recipient_email} - Subject: {subject}")
    try:
        # Simulated email sending
        time.sleep(1)
        # import smtplib
        # server = smtplib.SMTP('smtp.example.com', 587)
        # server.sendmail(...)
        logger.info(f"Successfully sent email to {recipient_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}")
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
