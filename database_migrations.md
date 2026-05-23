# Database Migrations Guide

This project uses [Alembic](https://alembic.sqlalchemy.org/en/latest/) for enterprise-grade database schema migrations. This ensures schema changes are deployed safely to production without data loss, replacing the unsafe `Base.metadata.create_all()` method.

## 1. Local Development Workflow

Whenever you modify, add, or delete a model in `backend/models.py`, you **must** generate a migration script before those changes will be reflected in the database.

### Step 1: Generate the Migration Script
Run the following command from the root of the repository:
```bash
alembic revision --autogenerate -m "description of changes"
```
*Example: `alembic revision --autogenerate -m "add invoice status column"`*

### Step 2: Review the Script
Always inspect the newly generated Python file inside the `alembic/versions/` directory. Autogenerate is smart, but it can sometimes miss complex column renames or table drops. Ensure the `upgrade()` and `downgrade()` functions look correct.

### Step 3: Apply the Migration Locally
Run the upgrade command to apply the changes to your local database (e.g., `erp_v8.db` or local PostgreSQL):
```bash
alembic upgrade head
```

### Step 4: Commit to Git
Commit your modified `models.py` AND the newly generated script inside `alembic/versions/` to version control.

---

## 2. Production Deployment Flow

Our deployment pipelines (Docker and Render) are configured to automatically apply pending migrations **before** the FastAPI server boots up.

*   **Docker:** The `docker-compose.yml` runs `alembic upgrade head && uvicorn...`
*   **Render:** The `render.yaml` Blueprint specifies `startCommand: alembic upgrade head && uvicorn...`

Because this is a synchronous step blocking the web server boot sequence, the application guarantees it will never boot with a schema mismatch.

---

## 3. Rollback Strategy

If a deployment introduces a critical bug due to a migration, you can safely roll back the database schema.

### Reverting the Last Migration
To step back exactly one migration:
```bash
alembic downgrade -1
```

### Reverting to a Specific Revision
Find the stable revision hash you want to return to:
```bash
alembic history
```
Then downgrade to that specific hash:
```bash
alembic downgrade <target_hash>
```

> [!WARNING]
> **Data Loss Risk:** Downgrading a migration that dropped columns or tables will re-create those columns/tables, but it will **not** restore the data that was deleted. Always ensure you have automated PostgreSQL backups (via Render or Neon) enabled for point-in-time recovery before performing risky schema rollbacks.
