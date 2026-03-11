"""
One-shot migration script to create the rooms, room_members, room_notes,
and chat_messages tables in your Supabase project.

Usage:
    python3 migrate_rooms.py --db-url "postgresql://postgres:<PASSWORD>@db.mcyppfjrftbczgpuwouu.supabase.co:5432/postgres"

The DB password is found in:
    Supabase Dashboard → Settings → Database → Connection string → Password
"""

import asyncio
import argparse
import asyncpg

MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS public.rooms (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE NOT NULL,
    owner_id   UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_owner_idx ON public.rooms(owner_id);
CREATE INDEX IF NOT EXISTS rooms_slug_idx  ON public.rooms(slug);

CREATE TABLE IF NOT EXISTS public.room_members (
    room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS room_members_user_idx ON public.room_members(user_id);

CREATE TABLE IF NOT EXISTS public.room_notes (
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (note_id, room_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx  ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(created_at);
"""


async def run(db_url: str) -> None:
    print("Connecting to database…")
    conn = await asyncpg.connect(db_url)
    print("Connected. Running migration…")
    await conn.execute(MIGRATION_SQL)
    await conn.close()
    print("Done. Tables created (or already existed).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create NeuroNotes rooms tables in Supabase.")
    parser.add_argument("--db-url", required=True, help="PostgreSQL connection string")
    args = parser.parse_args()
    asyncio.run(run(args.db_url))
