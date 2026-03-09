import os
import asyncio
import asyncpg
import logging
from typing import Optional

logger = logging.getLogger("database")


class SupabaseDB:
    _pool: Optional[asyncpg.Pool] = None
    _lock = asyncio.Lock()

    @classmethod
    async def initialize(cls) -> None:
        """
        Initialize asyncpg connection pool with Supabase PgBouncer compatibility.
        Uses transaction pooler (port 6543) with statement caching disabled.
        """
        async with cls._lock:
            if cls._pool:
                return

            db_host = os.environ["SUPABASE_DB_HOST"]
            db_user = os.environ["SUPABASE_DB_USER"]
            db_password = os.environ["SUPABASE_DB_PASSWORD"]
            db_name = os.environ.get("SUPABASE_DB_NAME", "postgres")
            db_port = int(os.environ.get("SUPABASE_DB_PORT", 6543))

            retries = 5
            delay = 3

            for attempt in range(retries):
                try:
                    cls._pool = await asyncpg.create_pool(
                        host=db_host,
                        port=db_port,
                        user=db_user,
                        password=db_password,
                        database=db_name,

                        min_size=2,
                        max_size=20,

                        command_timeout=30,
                        timeout=10,

                        ssl="require",

                        # REQUIRED for Supabase PgBouncer transaction pooling
                        statement_cache_size=0,
                        max_cached_statement_lifetime=0,
                        max_cacheable_statement_size=0,

                        server_settings={
                            "application_name": "neuronotes-backend"
                        },
                    )
                    logger.info("✅ Supabase connection pool initialized (host=%s port=%d)", db_host, db_port)
                    return

                except Exception as e:
                    logger.error("❌ Database connection failed (attempt %d/%d): %s", attempt + 1, retries, e)
                    if attempt == retries - 1:
                        raise
                    await asyncio.sleep(delay)

    @classmethod
    async def pool(cls) -> asyncpg.Pool:
        if not cls._pool:
            await cls.initialize()
        return cls._pool

    @classmethod
    async def fetch(cls, query: str, *args):
        pool = await cls.pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)

    @classmethod
    async def fetchrow(cls, query: str, *args):
        pool = await cls.pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    @classmethod
    async def fetchval(cls, query: str, *args):
        pool = await cls.pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    @classmethod
    async def execute(cls, query: str, *args):
        pool = await cls.pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)

    @classmethod
    async def executemany(cls, query: str, args_list):
        pool = await cls.pool()
        async with pool.acquire() as conn:
            return await conn.executemany(query, args_list)

    @classmethod
    async def healthcheck(cls) -> bool:
        try:
            val = await cls.fetchval("SELECT 1")
            return val == 1
        except Exception as e:
            logger.warning("DB healthcheck failed: %s", e)
            return False

    @classmethod
    async def shutdown(cls):
        if cls._pool:
            await cls._pool.close()
            cls._pool = None
            logger.info("Database pool closed")
