# Docker Deployment

NeuroNotes uses Docker Compose to run three services: PostgreSQL, the FastAPI backend, and the Next.js frontend.

## Table of Contents
- [Services](#services)
- [Docker Compose Configuration](#docker-compose-configuration)
- [Volumes](#volumes)
- [Networking](#networking)
- [Environment Variable Injection](#environment-variable-injection)
- [Dockerfile: Backend](#dockerfile-backend)
- [Dockerfile: Frontend](#dockerfile-frontend)
- [Common Operations](#common-operations)

---

## Services

| Service | Container | Image | Port | Dependency |
|---------|-----------|-------|------|------------|
| `postgres` | `neuronotes_db` | `pgvector/pgvector:pg16` | 5432 | none |
| `backend` | `neuronotes_backend` | Built from `./backend/Dockerfile` | 8000 | postgres healthy |
| `frontend` | `neuronotes_frontend` | Built from `./frontend/Dockerfile` | 3000 | backend |

---

## Docker Compose Configuration

Full `docker-compose.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: neuronotes_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: neuronotes
      POSTGRES_PASSWORD: neuronotes
      POSTGRES_DB: neuronotes
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neuronotes"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: neuronotes_backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgresql+asyncpg://neuronotes:neuronotes@postgres:5432/neuronotes}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    env_file:
      - ./backend/.env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: neuronotes_frontend
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

---

## Volumes

The `pgdata` named volume persists PostgreSQL data across container restarts:

```yaml
volumes:
  pgdata:
```

The backend mounts the source directory as a volume for development hot-reload:
```yaml
volumes:
  - ./backend:/app
```

This means code changes in `backend/` are immediately reflected inside the container. Remove this volume in production for a fully containerized deployment.

---

## Networking

All services share Docker Compose's default network. The backend connects to postgres using the service name as hostname:

```
DATABASE_URL: postgresql+asyncpg://neuronotes:neuronotes@postgres:5432/neuronotes
```

The hostname `postgres` resolves to the `postgres` container's internal IP within the Docker network.

The `DATABASE_URL` defaults to the internal Docker network address. If you set a custom `DATABASE_URL` in `backend/.env` (e.g., Supabase), it overrides the default.

**Port mapping to host:**
- `0.0.0.0:5432 → postgres:5432`
- `0.0.0.0:8000 → backend:8000`
- `0.0.0.0:3000 → frontend:3000`

---

## Environment Variable Injection

The backend service loads variables in this priority order (highest to lowest):
1. `environment:` block in `docker-compose.yml`
2. `env_file: ./backend/.env`
3. Default values in `config.py`

The `GEMINI_API_KEY` is loaded from the shell environment or `backend/.env`:
```yaml
environment:
  GEMINI_API_KEY: ${GEMINI_API_KEY}
```

If `GEMINI_API_KEY` is not set in the shell, Docker Compose will warn but continue. Set it in `backend/.env`:
```bash
GEMINI_API_KEY=your_key_here
```

The frontend only receives `NEXT_PUBLIC_API_URL` at build time (Next.js bakes it into the static bundle).

---

## Dockerfile: Backend

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Notes:
- `libpq-dev` and `gcc` are required to compile `asyncpg` and `psycopg2` from source
- `--no-cache-dir` keeps the image smaller
- No `--reload` flag in production (use it in development with volume mount)
- Runs as root by default — consider adding a non-root user for production

---

## Dockerfile: Frontend

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

This is a multi-stage build:
1. **Builder stage**: installs all dependencies, builds the Next.js app
2. **Runner stage**: copies only the standalone output, much smaller final image

Requires `output: "standalone"` in `next.config.js` (or it may not be configured). If the build fails with missing `server.js`, add to `next.config.js`:
```js
module.exports = {
  output: "standalone",
};
```

---

## Common Operations

### Start all services
```bash
docker compose up -d
```

### Start only the database (for local backend development)
```bash
docker compose up postgres -d
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Stop all services (preserve data)
```bash
docker compose down
```

### Stop and delete all data
```bash
docker compose down -v
```

### Rebuild containers after code changes
```bash
docker compose up -d --build
```

Or rebuild a specific service:
```bash
docker compose up -d --build backend
```

### Access the database directly
```bash
docker exec -it neuronotes_db psql -U neuronotes -d neuronotes
```

### Check service health
```bash
docker compose ps
curl http://localhost:8000/health
```

### Scale backend (multiple instances, requires load balancer)
```bash
docker compose up -d --scale backend=3
```
Note: This requires removing the `container_name` and port conflict would need resolving with a load balancer.

---

## Related Documents

- [Quickstart](../setup/quickstart.md)
- [Production Deployment](production.md)
- [Environment Variables](../setup/environment-variables.md)
