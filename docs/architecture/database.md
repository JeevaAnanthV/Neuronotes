# Database Architecture

NeuroNotes uses PostgreSQL 16 with the pgvector extension. The schema is defined in SQLAlchemy ORM models and can also be applied via the Supabase schema SQL file.

## Table of Contents
- [Schema Overview](#schema-overview)
- [Tables](#tables)
- [Indexes](#indexes)
- [Relationships](#relationships)
- [pgvector Setup](#pgvector-setup)
- [Connection Configuration](#connection-configuration)
- [Migrations](#migrations)
- [Supabase Integration](#supabase-integration)

---

## Schema Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│    tags     │      │  note_tags   │      │    notes    │
├─────────────┤      ├──────────────┤      ├─────────────┤
│ id (PK)     │◄─────│ tag_id (FK)  │      │ id (PK)     │
│ name        │      │ note_id (FK) │─────►│ title       │
└─────────────┘      └──────────────┘      │ content     │
                                           │ created_at  │
                                           │ updated_at  │
                                           │ embedding   │ ← vector(768)
                                           └──────┬──────┘
                                                  │
                                    ┌─────────────┴──────────────┐
                                    │         note_links          │
                                    ├────────────────────────────┤
                                    │ source_id (FK → notes.id)  │
                                    │ target_id (FK → notes.id)  │
                                    │ similarity (float)         │
                                    └────────────────────────────┘
```

---

## Tables

### `notes`

The primary content table. Stores note text and the 768-dimensional embedding vector.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique note identifier |
| `title` | `varchar(500)` | NOT NULL, default `'Untitled'` | Note title |
| `content` | `text` | NOT NULL, default `''` | Note body (HTML from TipTap) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, auto-updated | Last modification timestamp |
| `embedding` | `vector(768)` | nullable | Gemini text-embedding-004 vector |

The `embedding` column is nullable because embedding generation is async — a newly created note has `NULL` embedding until the background task completes.

SQLAlchemy ORM definition:
```python
# backend/models.py:21-41
class Note(Base):
    __tablename__ = "notes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
```

### `tags`

A global tag registry. Tag names are unique across the entire application (no per-user namespacing).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique tag identifier |
| `name` | `varchar(100)` | NOT NULL, UNIQUE | Tag name (lowercase, hyphenated) |

Tags are created lazily in `POST /notes/{note_id}/tags/{tag_name}` — the tag is created if it does not already exist (get-or-create pattern using `db.flush()`).

### `note_tags`

Junction table for the many-to-many relationship between notes and tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `note_id` | `uuid` | PK, FK → `notes.id` ON DELETE CASCADE | Note reference |
| `tag_id` | `uuid` | PK, FK → `tags.id` ON DELETE CASCADE | Tag reference |

Cascade delete means removing a note removes its tag associations. Tag rows themselves are preserved (not deleted) when a note is deleted.

### `note_links`

Knowledge graph edges. Each row represents a semantic similarity relationship between two notes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `source_id` | `uuid` | PK, FK → `notes.id` ON DELETE CASCADE | Source note |
| `target_id` | `uuid` | PK, FK → `notes.id` ON DELETE CASCADE | Target note |
| `similarity` | `float` | NOT NULL, default `0.0` | Cosine similarity score (0.0 to 1.0) |

The composite primary key `(source_id, target_id)` ensures at most one edge per ordered pair. The graph recompute logic enforces `a.id < b.id` in SQL to prevent creating both `(A,B)` and `(B,A)` — the graph is undirected, visualized with directional arrows by React Flow.

---

## Indexes

### IVFFlat Index on `notes.embedding`

Created in `supabase/schema.sql`:
```sql
create index if not exists notes_embedding_idx
    on notes using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);
```

This is an Inverted File Flat (IVFFlat) index — an approximate nearest neighbor (ANN) index that partitions vectors into `100` clusters. For cosine similarity queries (`vector_cosine_ops`), it provides significant speedup over brute-force sequential scan once the table has hundreds of notes.

**Note:** IVFFlat requires that the table have data before building the index for optimal cluster assignment. For very small datasets (<1000 rows), the index overhead may be negligible. For exact nearest neighbor search, use `USING hnsw` or remove the index.

The `create_all` in `main.py` does not create this index — it must be created manually via Supabase SQL editor or a migration. The local Docker setup uses `pgvector/pgvector:pg16` which supports both IVFFlat and HNSW.

---

## Relationships

SQLAlchemy ORM relationships are defined on the `Note` model:

```python
# backend/models.py:33-42
tags: Mapped[list[Tag]] = relationship(
    "Tag", secondary="note_tags", back_populates="notes"
)
outgoing_links: Mapped[list["NoteLink"]] = relationship(
    "NoteLink", foreign_keys="NoteLink.source_id", back_populates="source"
)
incoming_links: Mapped[list["NoteLink"]] = relationship(
    "NoteLink", foreign_keys="NoteLink.target_id", back_populates="target"
)
```

The `tags` relationship uses the `note_tags` table as a secondary join table (SQLAlchemy many-to-many).

The two `NoteLink` relationships (`outgoing_links` and `incoming_links`) use explicit `foreign_keys` to disambiguate which FK column each relationship uses (required because `NoteLink` has two FKs pointing to the same `notes` table).

---

## pgvector Setup

### Docker (local development)
The `docker-compose.yml` uses the official pgvector image:
```yaml
image: pgvector/pgvector:pg16
```
This image has pgvector pre-installed. No additional setup needed.

### Manual PostgreSQL
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Supabase
Enable via the Supabase dashboard: Database → Extensions → vector. Or include in the schema SQL:
```sql
create extension if not exists vector;
```

### Cosine Similarity Query Pattern
```sql
-- Find top-5 most similar notes to a given embedding
SELECT id, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS score
FROM notes
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

The `<=>` operator computes cosine distance. `1 - distance = similarity`.

### Pairwise Similarity for Graph
```sql
-- Find all note pairs with cosine similarity >= threshold
SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS sim
FROM notes a, notes b
WHERE a.id < b.id
  AND a.embedding IS NOT NULL
  AND b.embedding IS NOT NULL
  AND 1 - (a.embedding <=> b.embedding) >= 0.75;
```

---

## Connection Configuration

`database.py` creates a single async engine shared across the application:

```python
# backend/database.py:7-8
engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```

- `echo=False` — no SQL logging (set to `True` for debugging)
- `pool_pre_ping=True` — validates connection with a cheap query before use, recovering from connection drops (important for Supabase which closes idle connections after 5 minutes)
- `expire_on_commit=False` — objects remain accessible after commit without triggering lazy loads (required in async SQLAlchemy)

### Connection Strings

**Local Docker:**
```
postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes
```

**Supabase:**
```
postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```
Note: Supabase uses port `6543` for the connection pooler (pgBouncer). The direct connection is port `5432` but is not exposed publicly in most Supabase projects.

---

## Migrations

Alembic is included (`alembic>=1.13.0`) but the migration history is not configured in this project. The current setup uses `create_all` for development.

To initialize Alembic migrations:
```bash
cd backend
alembic init alembic
# Edit alembic.ini: sqlalchemy.url = postgresql://...
# Edit alembic/env.py: target_metadata = models.Base.metadata
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

For production deployments, Alembic migrations are the recommended approach. `create_all` does not handle column additions, renames, or type changes in existing tables.

### Auto-update `updated_at`

In Supabase, `updated_at` is maintained by a PostgreSQL trigger:
```sql
-- supabase/schema.sql:47-58
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger notes_updated_at
    before update on notes
    for each row execute function update_updated_at();
```

In the local Docker setup, the SQLAlchemy model uses `onupdate=func.now()` which sets the value at the ORM layer before the SQL is issued.

---

## Supabase Integration

The project ships with `supabase/schema.sql` for applying the schema to a Supabase project. See [setup/supabase.md](../setup/supabase.md) for full instructions.

The frontend's `lib/supabase.ts` provides a Supabase JS client for optional real-time subscriptions:
```typescript
export function subscribeToNotes(onUpdate: (note: SupabaseNote) => void) {
    return supabase
        .channel("notes-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, ...)
        .subscribe();
}
```

This is not used by default in any page but is available for adding live note synchronization.

---

## Related Documents

- [Architecture Overview](overview.md)
- [Backend Architecture](backend.md)
- [Setup: Supabase](../setup/supabase.md)
- [Dataflow: Knowledge Graph](../dataflow/knowledge-graph.md)
