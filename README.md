# College ERP System — Dockerized Production Architecture

A full-stack, enterprise-grade **College ERP (Enterprise Resource Planning)** platform designed to manage and automate academic and administrative workflows for students, faculty, heads of department (HOD), accountants, and administrators.

The system is fully containerized using **Docker** and **Docker Compose**, providing a portable, isolated, and reproducible environment ready for deployment on any target system (including college lab computers) without requiring manual installations of Node.js, PostgreSQL, or npm on the host system.

---

## Architecture Overview

```
                                  [ Browser / Client ]
                                   :3000          :3001
                                     │              │
                    ┌────────────────┼──────────────┼────────────────┐
                    │ Docker Host    ▼              ▼                │
                    │         ┌─────────────┐ ┌─────────────┐        │
                    │         │  frontend   │ │   backend   │        │
                    │         │  (Next.js)  │ │  (Express)  │        │
                    │         └──────┬──────┘ └──────┬──────┘        │
                    │                │               │               │
                    │   erp_network  │               ▼               │
                    │   (bridge)     │        ┌─────────────┐        │
                    │                └───────►│  postgres   │        │
                    │                         │ (PostgreSQL)│        │
                    │                         └──────┬──────┘        │
                    │                                │               │
                    │                         erp_postgres_data      │
                    │                         (Named Volume)         │
                    └────────────────────────────────────────────────┘
```

### Services & Port Mappings

| Service | Technology | Internal Port | Host Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`frontend`** | Next.js 16 (React 19) | `3000` | `3000` | Multi-role Web Portal (Admin, Faculty, HOD, Student, Accountant) |
| **`backend`** | Node.js 20, Express, TypeScript | `3001` | `3001` | REST API, WebSockets (`socket.io`), JWT Authentication |
| **`postgres`** | PostgreSQL 16 Alpine | `5432` | Internal | Relational Database (Protected inside Docker bridge network) |

---

## Prerequisites for the Target / Lab Computer

To run this application on any clean lab computer, the only prerequisite is:

1. **Docker Engine & Docker Compose** (or **Docker Desktop** on Windows / macOS / Linux).
   - Verify installation:
     ```bash
     docker --version
     docker compose version
     ```
2. **Git** (to clone the repository).
   - Verify installation:
     ```bash
     git --version
     ```

> **Note:** Neither Node.js nor PostgreSQL is required on the host system. All runtimes, libraries, compilers, and database daemons are contained within the Docker containers.

---

## Quickstart Deployment Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/TBhuvanesh/college-erp.git
cd college-erp
```

### Step 2: Configure Environment Variables

Create the `.env` file from the provided `.env.example` template:

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Open `.env` in any text editor and ensure the secrets and database credentials are set:
- **`POSTGRES_PASSWORD`**: Set a secure password for the PostgreSQL administrator.
- **`JWT_ACCESS_SECRET`**: Set a random secret (at least 32 characters).
- **`JWT_REFRESH_SECRET`**: Set a random secret (at least 32 characters).
- **`NEXT_PUBLIC_API_URL`**: `http://localhost:3001/api` (or `http://<LAB_IP>:3001/api` if accessed across a local area network).

*(Optional)* You can generate cryptographic random keys on any machine with Node.js using:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Step 3: Build and Start Containers

Launch the entire stack in detached mode:

```bash
docker compose up -d --build
```

Docker Compose will:
1. Initialize the isolated bridge network (`erp_network`).
2. Provision the persistent PostgreSQL volume (`erp_postgres_data`).
3. Start PostgreSQL and verify its readiness via the health check.
4. Build the Express backend container and automatically execute all 50 database schema migrations.
5. Build the Next.js standalone frontend container.
6. Start both applications once dependencies are completely healthy.

### Step 4: Verify Container Status

```bash
docker compose ps
```

Expected output:
```
NAME               IMAGE                     COMMAND                  SERVICE    STATUS
erp_postgres       postgres:16-alpine        "docker-entrypoint.s…"   postgres   Up (healthy)
erp_backend        college-erp-backend       "sh -c 'node dist/db…"   backend    Up (healthy)
erp_frontend       college-erp-frontend      "docker-entrypoint.s…"   frontend   Up (healthy)
```

---

## Initial Database Seeding (First-Time Setup)

The database schema migrations run **automatically on container startup**.

To populate the database with initial sample departments, courses, faculty, students, timetables, and demo user accounts for Stage 1 evaluation, execute:

```bash
docker compose exec backend node dist/db/seed.js
```

### Pre-Configured Demo Accounts

| Role | Username / Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@college.edu` | `Admin@12345` |
| **Faculty / HOD** | `faculty.cse@college.edu` | `Faculty@12345` |
| **Student** | `23VE1A0501@college.edu` | `Student@12345` |
| **Accountant** | `accountant@college.edu` | `Admin@12345` |

---

## Accessing the ERP Application

- **Frontend Web Portal**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Backend API Base**: [http://localhost:3001/api](http://localhost:3001/api)

### Accessing Across College Lab LAN

If testing from another computer connected to the lab switch or Wi-Fi:

1. Identify the host machine's IP address:
   - On Windows: `ipconfig` (look for IPv4 Address, e.g., `192.168.1.50`)
   - On Linux / macOS: `ip a` or `ifconfig`
2. Update `.env` on the host machine:
   ```env
   CORS_ORIGIN=http://localhost:3000,http://192.168.1.50:3000
   NEXT_PUBLIC_API_URL=http://192.168.1.50:3001/api
   NEXT_PUBLIC_SOCKET_URL=http://192.168.1.50:3001
   ```
3. Rebuild the frontend container to bake in the target IP:
   ```bash
   docker compose up -d --build frontend
   ```
4. Access [http://192.168.1.50:3000](http://192.168.1.50:3000) from the secondary computer's web browser.

---

## Verifying Database Persistence

Database persistence is ensured via the named Docker volume `erp_postgres_data`.

To verify data persistence during Stage 1 verification:

### Test Procedure:
1. Log in to the application at [http://localhost:3000](http://localhost:3000) as Admin.
2. Navigate to **Announcements** or **Students** and create a new record (e.g., Announcement title: `Stage 1 Verification Active`).
3. Stop and restart the containers:
   ```bash
   docker compose restart
   ```
4. Refresh the web page — confirm that the created announcement is still present.
5. Stop and recreate the containers completely:
   ```bash
   docker compose down
   docker compose up -d
   ```
6. Log in again — confirm that all students, records, and the new announcement remain intact.

> **CRITICAL WARNING:** Never run `docker compose down -v`. The `-v` flag deletes all Docker volumes and will erase the database.

---

## Database Backup and Restoration

### Creating a Database Backup
To take a complete SQL backup of the active PostgreSQL database:

```bash
docker compose exec -T postgres pg_dump -U erp_admin erp_db > college_erp_backup.sql
```

### Restoring from a Database Backup
To restore data into a newly initialized PostgreSQL container:

```bash
docker compose exec -T postgres psql -U erp_admin -d erp_db < college_erp_backup.sql
```

---

## Useful Operational Commands

### View Live Container Logs
```bash
# View logs from all services
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# View database logs only
docker compose logs -f postgres
```

### Stop the Containers Safely
```bash
docker compose stop
```

### Shut Down Containers (Preserving Data Volume)
```bash
docker compose down
```

### Inspect Database Directly via psql
```bash
docker compose exec postgres psql -U erp_admin -d erp_db
```

---

## Troubleshooting Guide

### 1. Port Conflict (`Bind for 0.0.0.0:3000 failed: port is already allocated`)
If port 3000 or 3001 is used by an existing process:
- Stop local node processes running outside Docker:
  ```powershell
  # Windows PowerShell
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process
  ```
  ```bash
  # Linux / macOS
  pkill -f node
  ```
- Alternatively, modify the host port mapping in `compose.yaml`:
  `"3002:3000"` (Frontend) or `"3003:3001"` (Backend).

### 2. Backend Fails to Connect to Database
Check that `postgres` is healthy:
```bash
docker compose ps
docker compose logs postgres
```
Ensure that `DATABASE_URL` in `compose.yaml` uses the service name `postgres`, **never** `localhost`.

### 3. Frontend Cannot Reach Backend
- Ensure `NEXT_PUBLIC_API_URL` is set to `http://localhost:3001/api` (for local browser access) or `http://<HOST_IP>:3001/api` (for remote browser access).
- Verify CORS allowed origins in `.env` include your browser's address.

---

## Author & Project Information

- **Developer**: Bhuvanesh T
- **Project**: College ERP System (Stage 1 Verification)
- **Tech Stack**: Next.js 16, React 19, Node.js 20, Express, PostgreSQL 16, Docker Compose
