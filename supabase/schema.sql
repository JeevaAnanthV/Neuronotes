-- NeuroNotes Supabase Schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/<your-project>/sql
--
-- Prerequisites: pgvector extension must be enabled.
-- Supabase enables it via the Extensions dashboard or via the line below.

-- ── 1. Extensions ─────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ── 2. Tags table ─────────────────────────────────────────────────────────────
create table if not exists tags (
    id          uuid primary key default gen_random_uuid(),
    name        varchar(100) not null unique
);

-- ── 3. Notes table (768-dim embedding from Gemini text-embedding-004) ─────────
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

-- ── 4. Note–tag association ───────────────────────────────────────────────────
create table if not exists note_tags (
    note_id uuid not null references notes(id) on delete cascade,
    tag_id  uuid not null references tags(id)  on delete cascade,
    primary key (note_id, tag_id)
);

-- ── 5. Knowledge graph edges (cosine similarity between note embeddings) ───────
create table if not exists note_links (
    source_id  uuid not null references notes(id) on delete cascade,
    target_id  uuid not null references notes(id) on delete cascade,
    similarity float not null default 0.0,
    primary key (source_id, target_id)
);

-- ── 6. Flashcards table (SM-2 spaced repetition) ──────────────────────────────
create table if not exists flashcards (
    id          uuid primary key default gen_random_uuid(),
    note_id     uuid not null references notes(id) on delete cascade,
    question    text not null,
    answer      text not null,
    easiness    float not null default 2.5,
    repetitions int   not null default 0,
    interval    int   not null default 1,
    next_review timestamptz not null default now(),
    created_at  timestamptz not null default now()
);

create index if not exists flashcards_note_id_idx on flashcards(note_id);
create index if not exists flashcards_next_review_idx on flashcards(next_review);

-- ── 7. Auto-update updated_at on notes ───────────────────────────────────────
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

-- ── 8. RPC: upsert_note_embedding ─────────────────────────────────────────────
-- Called by services/vector.py after Gemini generates an embedding for a note.
create or replace function upsert_note_embedding(
    note_id        uuid,
    embedding_vector vector(768)
)
returns void language plpgsql as $$
begin
    update notes
    set embedding = embedding_vector
    where id = note_id;
end;
$$;

-- ── 9. RPC: similarity_search ─────────────────────────────────────────────────
-- Returns top-k notes ranked by cosine similarity to the query embedding.
create or replace function similarity_search(
    query_embedding  vector(768),
    match_count      int     default 5,
    match_threshold  float   default 0.4
)
returns table(id uuid, score float) language plpgsql as $$
begin
    return query
    select
        n.id,
        1 - (n.embedding <=> query_embedding) as score
    from notes n
    where
        n.embedding is not null
        and 1 - (n.embedding <=> query_embedding) >= match_threshold
    order by n.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- ── 10. RPC: recompute_note_links ─────────────────────────────────────────────
-- Rebuilds the entire note_links graph above a similarity threshold.
create or replace function recompute_note_links(threshold float default 0.75)
returns int language plpgsql as $$
declare
    inserted int;
begin
    delete from note_links;

    insert into note_links (source_id, target_id, similarity)
    select
        a.id as source_id,
        b.id as target_id,
        1 - (a.embedding <=> b.embedding) as similarity
    from notes a
    cross join notes b
    where
        a.id < b.id
        and a.embedding is not null
        and b.embedding is not null
        and 1 - (a.embedding <=> b.embedding) >= threshold;

    get diagnostics inserted = row_count;
    return inserted;
end;
$$;

-- ── 11. RPC: recompute_links_for_note ─────────────────────────────────────────
-- Incrementally updates knowledge-graph edges for a single note after save.
create or replace function recompute_links_for_note(
    p_note_id  uuid,
    p_threshold float default 0.75
)
returns void language plpgsql as $$
begin
    -- Remove stale edges involving this note
    delete from note_links
    where source_id = p_note_id or target_id = p_note_id;

    -- Re-insert edges against all other notes that have embeddings
    insert into note_links (source_id, target_id, similarity)
    select
        least(p_note_id, other.id),
        greatest(p_note_id, other.id),
        1 - (src.embedding <=> other.embedding)
    from notes src
    cross join notes other
    where
        src.id = p_note_id
        and other.id <> p_note_id
        and src.embedding is not null
        and other.embedding is not null
        and 1 - (src.embedding <=> other.embedding) >= p_threshold
    on conflict (source_id, target_id)
    do update set similarity = excluded.similarity;
end;
$$;

-- ── 12. Rooms (Collaboration) ────────────────────────────────────────────────

create table if not exists rooms (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    slug       text unique not null,
    owner_id   uuid not null,
    created_at timestamptz default now()
);

create index if not exists rooms_owner_idx on rooms(owner_id);
create index if not exists rooms_slug_idx  on rooms(slug);

create table if not exists room_members (
    room_id   uuid not null references rooms(id) on delete cascade,
    user_id   uuid not null,
    joined_at timestamptz default now(),
    primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on room_members(user_id);

create table if not exists room_notes (
    note_id uuid not null references notes(id) on delete cascade,
    room_id uuid not null references rooms(id) on delete cascade,
    primary key (note_id, room_id)
);

-- ── 13. Row-Level Security ────────────────────────────────────────────────────
-- The FastAPI backend connects with the service role key which bypasses RLS.
-- RLS is currently disabled. To enable per-user isolation in a future iteration,
-- uncomment the lines below and add appropriate policies.
--
-- alter table notes       enable row level security;
-- alter table tags        enable row level security;
-- alter table note_tags   enable row level security;
-- alter table note_links  enable row level security;
-- alter table flashcards  enable row level security;
