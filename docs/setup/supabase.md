# Supabase Setup

Connect NeuroNotes to Supabase as the cloud database backend. Supabase provides PostgreSQL 16 with pgvector support and optional real-time subscriptions.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Apply the Schema](#apply-the-schema)
- [Get the Connection String](#get-the-connection-string)
- [Configure the Backend](#configure-the-backend)
- [Configure the Frontend](#configure-the-frontend)
- [Real-time Subscriptions (Optional)](#real-time-subscriptions-optional)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Supabase account at https://supabase.com
- An existing Supabase project (or create a new one)

---

## Apply the Schema

Run `supabase/schema.sql` in the Supabase SQL Editor.

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Open a new query tab
5. Copy the contents of `supabase/schema.sql` and paste into the editor
6. Click **Run**

The schema creates:
- `vector` extension (pgvector)
- `notes` table (id, title, content, created_at, updated_at, embedding vector(768))
- IVFFlat index on `notes.embedding` for fast cosine similarity search
- `tags` table
- `note_tags` junction table
- `note_links` table for graph edges
- `update_updated_at()` trigger function
- Trigger to auto-update `updated_at` on note changes

---

## Get the Connection String

1. In the Supabase dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Select the **URI** tab
4. Choose **Connection pooler** (recommended for production — uses pgBouncer on port 6543)

The format is:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

For SQLAlchemy asyncpg, replace `postgresql://` with `postgresql+asyncpg://`:
```
postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Where to find the password:** Settings → Database → Database Password. This is different from your Supabase account password.

---

## Configure the Backend

Update `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres.mcyppfjrftbczgpuwouu:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
GEMINI_API_KEY=your_gemini_api_key_here
```

Restart the backend:
```bash
uvicorn main:app --reload --port 8000
```

Verify the connection:
```bash
curl http://localhost:8000/health
# If it responds, the DB connection is working
curl http://localhost:8000/notes/
# Returns [] for empty DB, or a list of notes
```

---

## Configure the Frontend

The frontend has `lib/supabase.ts` which creates a Supabase JS client for optional real-time features. This uses your project's public anonymous key.

Update `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Find these values in Supabase dashboard → **Settings** → **API**:
- `NEXT_PUBLIC_SUPABASE_URL`: the Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the `anon` (public) key

**Note:** These values are already hardcoded as fallbacks in `lib/supabase.ts`. Setting them in `.env.local` is optional but recommended for proper environment separation.

---

## Real-time Subscriptions (Optional)

The `lib/supabase.ts` client includes a `subscribeToNotes` helper that listens to Postgres changes via Supabase Realtime:

```typescript
// frontend/lib/supabase.ts:43-52
export function subscribeToNotes(onUpdate: (note: SupabaseNote) => void) {
    return supabase
        .channel("notes-changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notes" },
            (payload) => onUpdate(payload.new as SupabaseNote)
        )
        .subscribe();
}
```

To use this in a component:
```typescript
import { subscribeToNotes } from "@/lib/supabase";

useEffect(() => {
    const subscription = subscribeToNotes((updatedNote) => {
        // refresh notes list when any note changes
        loadNotes();
    });
    return () => { subscription.unsubscribe(); };
}, []);
```

Enable Realtime for the `notes` table in Supabase: **Database** → **Replication** → enable the `notes` table.

---

## Row-Level Security (Optional)

The schema has RLS commented out by default. Enable it if you add Supabase Auth for per-user note isolation:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust to your auth model)
CREATE POLICY "Users can manage their own notes"
  ON notes FOR ALL
  USING (auth.uid() IS NOT NULL);
```

The FastAPI backend uses the service role key or direct database URL which bypasses RLS.

---

## Troubleshooting

### Connection refused or timeout
- Check that the connection string uses port `6543` (pooler), not `5432` (direct)
- Verify the password doesn't contain special characters that need URL encoding (e.g., `@` → `%40`)
- Check Supabase project is not paused (free tier pauses after 1 week of inactivity)

### SSL connection errors
Add `?sslmode=require` to the end of the DATABASE_URL if needed:
```
...pooler.supabase.com:6543/postgres?sslmode=require
```

### Tables not found
Run `supabase/schema.sql` in the SQL Editor. The `create_all` in `main.py:32` also creates tables on startup, but the IVFFlat index must be created manually.

### pgvector extension missing
Run in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Or enable it via Dashboard → **Database** → **Extensions** → search "vector" → enable.

---

## Related Documents

- [Environment Variables](environment-variables.md)
- [Local Development](local-development.md)
- [Database Architecture](../architecture/database.md)
