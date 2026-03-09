# Production Deployment

Checklist and recommendations for deploying NeuroNotes to production.

## Table of Contents
- [Architecture](#architecture)
- [Recommended Hosting Stack](#recommended-hosting-stack)
- [Frontend: Vercel](#frontend-vercel)
- [Backend: Railway or Render](#backend-railway-or-render)
- [Database: Supabase](#database-supabase)
- [Security Checklist](#security-checklist)
- [Environment Hardening](#environment-hardening)
- [Performance Considerations](#performance-considerations)
- [Monitoring](#monitoring)

---

## Architecture

```
Internet
    │
    ├─ Vercel (or Netlify)
    │     Next.js frontend
    │     Edge CDN distribution
    │         │
    │         │ HTTPS API calls
    │         ▼
    ├─ Railway (or Render)
    │     FastAPI + uvicorn
    │     Single container
    │         │
    │         │ asyncpg over TLS
    │         ▼
    └─ Supabase
          PostgreSQL 16 + pgvector
          Connection pooler (pgBouncer)
```

---

## Recommended Hosting Stack

| Component | Service | Why |
|-----------|---------|-----|
| Frontend | **Vercel** | Native Next.js support, edge CDN, zero-config |
| Backend | **Railway** or **Render** | Simple container deployment, auto-scaling |
| Database | **Supabase** | Managed PostgreSQL 16 with pgvector built-in |
| Secrets | Host platform secrets manager | Never store secrets in code |

---

## Frontend: Vercel

### Deploy

1. Push to GitHub
2. Import the `frontend/` directory in Vercel (monorepo support)
3. Set the root directory to `frontend`
4. Set environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`
5. Deploy

### Configuration

Vercel auto-detects Next.js. No configuration file needed for basic deployment.

For custom domains, configure in Vercel dashboard → Domains.

### Environment Variables on Vercel

Set in Vercel dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL=https://api.neuronotes.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Backend: Railway or Render

### Deploy to Railway

1. Connect GitHub repository
2. Set root directory to `backend`
3. Railway auto-detects the `Dockerfile` and builds it
4. Set environment variables (see Security Checklist below)
5. Configure the public domain

### Deploy to Render

1. New Web Service → connect GitHub
2. Root directory: `backend`
3. Build command: (empty — uses Dockerfile)
4. Environment: Docker
5. Set environment variables
6. Deploy

### Production start command

The production Dockerfile already uses:
```
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

For production, add workers if CPU-bound:
```
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

Note: FastAPI uses async I/O, so multiple workers are not required for I/O-bound workloads. Start with 1 worker and scale if needed.

---

## Database: Supabase

See [Supabase Setup](../setup/supabase.md) for schema setup instructions.

**Production settings:**
- Use the **connection pooler** (port 6543) to handle connection limits
- Enable **pgBouncer** transaction mode for stateless FastAPI connections
- Monitor pool utilization in Supabase dashboard → Database → Pooler

---

## Security Checklist

### Required before going live

- [ ] Set `GEMINI_API_KEY` as a secret (not in version control)
- [ ] Set `CORS_ORIGINS` to only your frontend domain:
  ```
  CORS_ORIGINS=["https://neuronotes.yourdomain.com"]
  ```
- [ ] Remove `- ./backend:/app` volume mount from `docker-compose.yml` (development hot-reload)
- [ ] Change default database password from `neuronotes` to a strong random password
- [ ] Ensure `DATABASE_URL` is set as an encrypted secret, not in `docker-compose.yml`
- [ ] Use HTTPS for all frontend and backend URLs

### Recommended

- [ ] Add authentication before exposing publicly (the API currently has no auth)
- [ ] Set up database backups (Supabase handles this automatically on paid plans)
- [ ] Enable Supabase Row-Level Security if adding multi-user support
- [ ] Configure Supabase project password and service role key rotation schedule
- [ ] Add a `RATE_LIMIT` appropriate for your expected traffic (default 60/min may be too high or low)
- [ ] Set up monitoring/alerting for 5xx error rates

---

## Environment Hardening

### Backend `.env` for production

```env
# Use Supabase connection pooler
DATABASE_URL=postgresql+asyncpg://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Your Gemini API key
GEMINI_API_KEY=<from secrets manager>

# Tighter CORS
CORS_ORIGINS=["https://neuronotes.yourdomain.com"]

# More conservative rate limit
RATE_LIMIT=30/minute

# Use latest stable models
CHAT_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=models/text-embedding-004
```

### Uvicorn production flags

For production deployments, do not use `--reload`. Consider adding:
```bash
uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --no-access-log \   # use the middleware logging instead
    --proxy-headers \   # trust X-Forwarded-For from proxy
    --forwarded-allow-ips="*"  # or specific proxy IP
```

---

## Performance Considerations

### Backend

- **Gemini API latency**: Embedding generation takes 200–600ms. This is the main source of latency on note saves. Acceptable for the background task pattern used.
- **Search latency**: Query embedding + vector search typically 200–500ms. Can be reduced by caching frequent queries.
- **Connection pooling**: The asyncpg engine uses a connection pool. Default pool size is adequate for moderate traffic.

### Database

- **IVFFlat index**: The `notes_embedding_idx` index speeds up similarity search significantly at scale (100+ notes). For < 50 notes, sequential scan may be faster.
- **pgBouncer**: Supabase's connection pooler prevents connection saturation. Use transaction mode for stateless FastAPI.
- **Graph recompute cost**: `POST /graph/recompute` is O(n²) and runs synchronously. For 1000+ notes this could take several seconds. Consider running it as a background task for large knowledge bases.

### Frontend

- **Vercel edge CDN**: Static assets are cached globally. The Next.js app shell loads fast; data loading depends on backend latency.
- **No SSR**: All pages are client-rendered. The initial page load shows a loading spinner while data fetches. This is acceptable for a productivity app but may affect SEO.

---

## Monitoring

### Suggested tools

| Concern | Tool |
|---------|------|
| Error tracking | Sentry (add to both backend and frontend) |
| Uptime monitoring | UptimeRobot or BetterUptime |
| Backend metrics | Railway/Render built-in metrics |
| Database metrics | Supabase dashboard (query times, connection counts) |
| API latency | X-Request-ID header in logs (already implemented) |

### Health check endpoint

Use `GET /health` for uptime monitoring:
```
curl https://api.neuronotes.yourdomain.com/health
# {"status": "ok", "service": "NeuroNotes API"}
```

### Log format

The backend logs in this format:
```
2026-03-09T10:00:00 [INFO] neuronotes: POST /notes/ 201 (23.4ms) [a3f8e12b]
```

Railway and Render capture stdout logs automatically.

---

## Related Documents

- [Docker Deployment](docker.md)
- [Supabase Setup](../setup/supabase.md)
- [Environment Variables](../setup/environment-variables.md)
