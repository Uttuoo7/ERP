module.exports = {
  apps: [
    {
      name: 'p2p-erp-backend',
      script: 'uvicorn',
      args: 'backend.main:app --host 0.0.0.0 --port 8000',
      interpreter: 'python', // uses python or virtual env's python
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://erp_user:erp_password@localhost:5432/p2p_erp',
        JWT_SECRET: 'super_secret_p2p_erp_key_for_jwt_tokens',
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true
    },
    {
      name: 'p2p-erp-frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true
    }
  ]
};
