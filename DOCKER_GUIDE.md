# Docker Deployment Guide (with Cloud Database)

This project is configured for multi-stage Docker deployment with an external cloud PostgreSQL database (e.g., **Neon**, **Supabase**, **AWS RDS**, **DigitalOcean Managed Postgres**).

---

## Architecture

- **Backend Container (`college-erp-backend:latest`)**:
  - Node.js 20 Alpine multi-stage build.
  - Automatically runs schema migrations against your cloud database on startup.
  - Exposes port `3001`.
  - Persists uploaded files (`uploads/documents` and `uploads/lms`) inside a named Docker volume (`erp_uploads`).
- **Frontend Container (`college-erp-frontend:latest`)**:
  - Next.js 16 standalone production bundle.
  - Runs with an unprivileged `nextjs` user for container security.
  - Exposes port `3000`.
- **Database**:
  - External managed cloud database.
  - SSL connection with Neon cold-start tolerance already configured in `backend/src/config/database.ts`.

---

## Quick Start

### 1. Configure Environment Variables

Copy `.env.docker.example` to `.env` in the root directory:

```bash
cp .env.docker.example .env
```

Edit `.env` and fill in your cloud database details:

```env
# Cloud Postgres Connection URL (with sslmode=require)
DATABASE_URL=postgresql://user:password@ep-xyz.region.neon.tech/erp_db?sslmode=require

# 32+ character secrets (generate via: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_ACCESS_SECRET=your_super_secret_access_token_key_here_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_here_min_32_chars

# Domain configurations
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

*(For production server deployments, change `localhost:3000` and `localhost:3001` to your public domains or reverse proxy paths.)*

---

### 2. Build and Start Containers

Run with Docker Compose:

```bash
docker compose up --build -d
```

To view real-time logs:

```bash
docker compose logs -f
```

To stop containers:

```bash
docker compose down
```

---

## Individual Docker Image Commands

If you prefer building and pushing individual images (e.g., to AWS ECR, Docker Hub, or GitHub Packages):

### Backend Image

```bash
# Build
docker build -t college-erp-backend:latest ./backend

# Run with cloud database and persistent upload volume
docker run -d \
  --name erp-backend \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/erp_db?sslmode=require" \
  -e JWT_ACCESS_SECRET="min_32_chars_secret" \
  -e JWT_REFRESH_SECRET="min_32_chars_secret" \
  -e CORS_ORIGIN="https://your-frontend-domain.com" \
  -v erp_uploads:/app/uploads \
  college-erp-backend:latest
```

### Frontend Image

```bash
# Build (bake production API endpoint into frontend bundle)
docker build \
  --build-arg NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api" \
  --build-arg NEXT_PUBLIC_SOCKET_URL="https://api.yourdomain.com" \
  -t college-erp-frontend:latest ./frontend

# Run
docker run -d \
  --name erp-frontend \
  -p 3000:3000 \
  college-erp-frontend:latest
```

---

## Important Operational Notes

1. **Database Migrations**:
   The backend container is configured to automatically run `node dist/db/migrate.js` on boot before starting the server. New schema migrations will be applied seamlessly upon every deployment.

2. **Persistent Uploads**:
   Student documents and LMS materials are saved to the `erp_uploads` volume. Rebuilding or updating the containers will **not** delete uploaded files.
   To inspect the volume:
   ```bash
   docker volume inspect erp_uploads
   ```

3. **Cloud Database Whitelisting**:
   Ensure your cloud database firewall allows inbound connections from your Docker host's IP address (or `0.0.0.0/0` with SSL enabled and strong credentials).
