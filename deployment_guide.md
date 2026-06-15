# P2P ERP Production Deployment Guide

This guide describes how to deploy and run the P2P ERP system in production using either **Docker** or **PM2**.

---

## 1. Environment Configuration

Create a `.env` file in the root directory. This contains critical environment details:

```env
# Database Configuration
DATABASE_URL=postgresql://erp_user:erp_password@localhost:5432/p2p_erp

# Security (JWT Auth)
JWT_SECRET=super_secret_p2p_erp_key_for_jwt_tokens
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Server Configurations
CORS_ORIGINS=http://localhost,http://localhost:80,http://localhost:5173,http://localhost:8000
PORT=8000
```

---

## 2. Option A: Deployment via Docker & Compose (Recommended)

Docker Compose encapsulates the database (PostgreSQL), backend (FastAPI), and frontend (Nginx serving the React SPA) in fully isolated containers.

### Prerequisites
- Docker & Docker Compose installed on your host.

### Startup Steps
1. Navigate to the root directory containing `docker-compose.yml`.
2. Run the build and start command:
   ```bash
   docker-compose up --build -d
   ```
3. Docker will:
   - Start the PostgreSQL database and run a health check.
   - Build the backend using `Dockerfile.backend` and start it once the DB is healthy.
   - Build the frontend statically using `Dockerfile.frontend` and serve it through Nginx.
4. Your application will be live at:
   - **Frontend UI**: `http://localhost` (Port 80)
   - **Backend API**: `http://localhost:8000`
   - **API Docs**: `http://localhost:8000/docs`
   - **Health Check**: `http://localhost:8000/api/health`

---

## 3. Option B: Native Deployment via PM2 (Process Manager)

Use PM2 for a lightweight local production setup without container overhead.

### Prerequisites
- Node.js & NPM installed.
- Python 3.10+ installed.
- PostgreSQL database installed, running locally, and matched with the credentials in your `.env`.

### Startup Steps
1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
2. Build the React frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```
3. Start the entire ERP system (backend + frontend) using the provided PM2 config:
   ```bash
   pm2 start ecosystem.config.cjs
   ```
4. Verify the processes are active:
   ```bash
   pm2 status
   ```
5. View unified logs:
   ```bash
   pm2 logs
   ```

---

## 4. PostgreSQL Database Migration Recommendations

When moving to PostgreSQL, you will start with a fresh database. FastAPI automatically handles the creation of all required database tables (`Base.metadata.create_all`) and triggers seeding operations (`seed_users` and `seed_warehouses`) on start.

For future database schema modifications, it is highly recommended to initialize **Alembic**:
```bash
alembic init alembic
```
Create a migration revision whenever you edit `models.py`:
```bash
alembic revision --autogenerate -m "description_of_change"
alembic upgrade head
```

---

## 5. Option C: Free Cloud Deployment via Koyeb & Vercel (Recommended for Online Hosting)

You can host the application online for free without cold-start/sleep delays by deploying the backend to **Koyeb** and the frontend to **Vercel**.

### Step 1: Deploy Backend to Koyeb
1. Sign up for a free account at [Koyeb.com](https://www.koyeb.com).
2. Go to the Control Panel and click **Create Service**.
3. Choose **GitHub** as the source, select your repository, and select the `main` branch.
4. Koyeb will detect the [koyeb.yaml](file:///C:/Users/ASUS/.gemini/antigravity/scratch/P2P_ERP/koyeb.yaml) configuration file automatically.
5. In the **Environment Variables** section, customize the values:
   - `DATABASE_URL`: By default, the app runs on a local SQLite file. For persistent data, you can create a free PostgreSQL database on Koyeb and paste the connection string here.
   - `SECRET_KEY`: Set this to a secure random string.
6. Click **Deploy**. Once the build finishes, Koyeb will give you a public URL (e.g. `https://xxx.koyeb.app`).

### Step 2: Deploy Frontend to Vercel
1. Sign up for a free account at [Vercel.com](https://vercel.com).
2. Click **Add New** -> **Project** and select your GitHub repository.
3. In the project settings, set:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Expand **Environment Variables** and add:
   - `VITE_API_URL`: Paste your Koyeb backend URL here (e.g. `https://xxx.koyeb.app`).
   - `VITE_WS_URL`: Paste the WebSocket equivalent of your backend URL (change `https://` to `wss://`, e.g. `wss://xxx.koyeb.app/api/ws`).
5. Click **Deploy**. Vercel will build the frontend, and your ERP will be live online!

