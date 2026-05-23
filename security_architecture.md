# Enterprise Security Architecture

This document details the advanced security protocols and attack mitigations implemented to graduate the P2P ERP platform to a SaaS-ready enterprise environment.

## 1. Rate Limiting & Brute-Force Prevention
We integrated **SlowAPI** (backed by an in-memory/Redis limiter) into the FastAPI middleware layer. 
* **Target Mitigation:** The `/login` endpoint is now restricted to `5 requests per minute` per IP address. This effectively nullifies credential stuffing and brute-force password guessing attacks. 

## 2. API Security Headers
A custom `SecurityHeadersMiddleware` now intercepts every outgoing HTTP response to inject critical browser protections:
* `Strict-Transport-Security (HSTS)`: Forces browsers to only communicate over HTTPS for the next year.
* `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing (mitigates drive-by downloads).
* `X-Frame-Options: DENY`: Prevents Clickjacking by disallowing the ERP from being embedded in an iframe.
* `X-XSS-Protection: 1; mode=block`: Instructs older browsers to aggressively block suspected Cross-Site Scripting (XSS) attacks.

## 3. JWT Rotation & Authentication Integrity
The application natively handles refresh token rotation:
* **Short-Lived Access Tokens:** Expire in 30 minutes, minimizing the window of vulnerability if intercepted.
* **Token Rotation:** When a refresh token is used, it is instantly revoked and a new pair is issued.
* **Reuse Detection:** If an attacker attempts to use an already-revoked refresh token, the system detects this anomaly and immediately revokes **all** active sessions for that user, requiring a hard re-login.

## 4. Immutable Audit Trails
The `AuditSecurityLog` and `PurchaseRequisitionAudit` models are strictly append-only. No application logic exists to update or delete these records (`DELETE` constraints are explicitly omitted in the ORM). This ensures that forensic data regarding RBAC mutations, PR approvals, and login failures remains tamper-proof.

## 5. Background Worker Security (Celery & Redis)
* **Pickle RCE Mitigation:** Celery is strictly configured with `accept_content=['json']`. This prevents a critical vulnerability where an attacker with Redis access could execute arbitrary remote code (RCE) via malicious `pickle` payloads.
* **Phantom Task Protection:** Enabled `task_acks_late=True` and `worker_cancel_long_running_tasks_on_connection_loss=True`. If a Celery worker dies midway through sending an email or syncing with Tally, the message is NOT acknowledged. It safely remains in Redis and is picked up by the next available worker, ensuring zero data loss.

## Deployment Hardening Checklist (Render & Docker)
1. **Network Isolation:** In `render.yaml`, ensure the PostgreSQL and Redis instances are set to **Internal Connectivity Only**. They should not have public IPs. The FastAPI Web Service is the only point of ingress.
2. **CORS:** Ensure `CORS_ORIGINS` in your environment strictly points to your exact Vercel domains (e.g., `https://erp.vercel.app`), never `*` in production.
3. **Database Passwords:** Leverage Render's native Secret Management to rotate the `DATABASE_URL` and `REDIS_URL` periodically without touching code.
