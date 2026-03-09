# Quickstart

Get NeuroNotes running in 5 minutes using Docker Compose.

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- A **Google Gemini API key** (free at https://aistudio.google.com/app/apikey)

---

## Step 1: Clone the repository

```bash
git clone https://github.com/yourorg/neuronotes.git
cd neuronotes
```

---

## Step 2: Configure environment variables

Copy the example env file:
```bash
cp .env.example backend/.env
```

Edit `backend/.env` and set your Gemini API key:
```bash
GEMINI_API_KEY=your_key_here
```

The default database URL points to the Docker postgres container and works out of the box:
```
DATABASE_URL=postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes
```

---

## Step 3: Start all services

```bash
docker compose up -d
```

This starts three services:
- `postgres` — PostgreSQL 16 with pgvector on port 5432
- `backend` — FastAPI on port 8000 (waits for postgres to be healthy)
- `frontend` — Next.js on port 3000 (waits for backend)

First run downloads images and builds containers. Subsequent starts take a few seconds.

---

## Step 4: Verify the services are running

```bash
docker compose ps
```

All three services should show `running`. Check health:
```bash
curl http://localhost:8000/health
# {"status": "ok", "service": "NeuroNotes API"}
```

---

## Step 5: Open the application

Open your browser to **http://localhost:3000**.

You should see the NeuroNotes dashboard. Click "Create First Note" to get started.

---

## Create your first note

1. Click "New Note" in the sidebar (or press `Ctrl+N`)
2. Type a title
3. Start writing in the editor
4. Wait 1.5 seconds — the note autosaves and the AI embedding runs in the background
5. Type `/` to see AI commands (summarize, expand, research, etc.)
6. Click "Auto Tags" in the right panel to generate tags automatically

---

## Explore the features

| Feature | Where to find |
|---------|--------------|
| Semantic search | `Ctrl+K` from anywhere |
| Knowledge graph | Sidebar → Graph |
| AI Chat | Sidebar → AI Chat |
| AI Insights | Sidebar → Insights |
| Voice notes | Note editor → microphone button |

---

## Stopping the application

```bash
docker compose down
```

Data is persisted in the `pgdata` Docker volume and survives container restarts.

To also delete the data:
```bash
docker compose down -v
```

---

## Related Documents

- [Local Development Setup](local-development.md)
- [Environment Variables](environment-variables.md)
- [Docker Deployment](../deployment/docker.md)
