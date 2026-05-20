# P2P ERP Troubleshooting & Backup Guide

This guide details common ERP operational issues, debugging procedures, and backup/recovery recommendations.

---

## 1. Troubleshooting ERP Runtime Issues

### Issue A: "Database connection failed / Server error 500"
* **Symptom**: Frontend displays error toasts or backend shows connection timeout logs.
* **Why it happens**: The FastAPI backend cannot connect to the PostgreSQL instance (either Postgres is offline, credentials in `.env` are mismatched, or the Docker network is blocked).
* **Fixes**:
  1. Verify the PostgreSQL service is active:
     ```bash
     pg_isready -h localhost -p 5432 -U erp_user
     ```
  2. Double-check your `.env` connection string.
  3. If running inside Docker, ensure you are utilizing the container host address `db:5432` rather than `localhost:5432` since localhosts do not bridge automatically inside private networks.

### Issue B: "Failed to fetch / Network Error"
* **Symptom**: Page loads but items, purchase orders, or analytics show "Network error" toast notifications.
* **Why it happens**: CORS configuration block or backend server offline.
* **Fixes**:
  1. Inspect the backend terminal console.
  2. Inspect the `.env` value for `CORS_ORIGINS`. If the client is requesting from a new URL (e.g., `http://192.168.1.100:5173`), it MUST be appended to `CORS_ORIGINS` inside `.env`.

### Issue C: "White Screen of Death" on Frontend
* **Symptom**: The browser displays a blank white screen when navigating pages.
* **Why it happens**: An unhandled runtime error inside a React component's rendering logic.
* **Fixes**:
  1. The new robust React **Error Boundary** will intercept the crash, preventing a blank screen and rendering an error traceback with a reload button.
  2. Inspect the browser's developer console (`F12`) to read the exact traceback.

---

## 2. PostgreSQL Backup & Recovery Recommendations

To secure your production database, automate regular database backups.

### Automated Backups (Using pg_dump)
Create a daily script or cronjob to run the following backup command:

```bash
pg_dump -U erp_user -d p2p_erp -h localhost -F c -b -v -f "/backups/p2p_erp_$(date +%F).backup"
```

### Restoration (Using pg_restore)
To restore a backup to a clean database instance:

1. Re-create the empty database:
   ```sql
   DROP DATABASE IF EXISTS p2p_erp;
   CREATE DATABASE p2p_erp;
   ```
2. Run the restoration command:
   ```bash
   pg_restore -U erp_user -d p2p_erp -h localhost -v "/backups/p2p_erp_selected_file.backup"
   ```
