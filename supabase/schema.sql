-- NeuroNotes Supabase Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/mcyppfjrftbczgpuwouu/sql
--
-- Prerequisites: pgvector extension must be enabled.
-- Supabase enables it via the Extensions dashboard or via the line below.

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Tags table
create table if not exists tags (
    id          uuid primary key default gen_random_uuid(),
    name        varchar(100) not null unique
);

-- 3. Notes table (768-dim embedding from Gemini text-embedding-004)
create table if not exists notes (
    id          uuid primary key default gen_random_uuid(),
    title       varchar(500) not null default 'Untitled',
    content     text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    embedding   vector(768)
);

-- Index for fast cosine similarity search
create index if not exists notes_embedding_idx
    on notes using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- 4. Note–tag association
create table if not exists note_tags (
    note_id uuid not null references notes(id) on delete cascade,
    tag_id  uuid not null references tags(id)  on delete cascade,
    primary key (note_id, tag_id)
);

-- 5. Knowledge graph edges (cosine similarity between note embeddings)
create table if not exists note_links (
    source_id  uuid not null references notes(id) on delete cascade,
    target_id  uuid not null references notes(id) on delete cascade,
    similarity float not null default 0.0,
    primary key (source_id, target_id)
);

-- 6. Auto-update updated_at on notes
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
    before update on notes
    for each row execute function update_updated_at();

-- 7. Row-Level Security (optional — disable if using service role key only)
-- The FastAPI backend connects with the service role key and bypasses RLS.
-- Enable RLS only if you add Supabase Auth for per-user note isolation.
-- alter table notes    enable row level security;
-- alter table tags     enable row level security;
-- alter table note_tags enable row level security;
-- alter table note_links enable row level security;
