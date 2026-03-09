from supabase import create_client, Client
from config import get_settings

settings = get_settings()

_supabase: Client | None = None


def get_db() -> Client:
    """Return the singleton Supabase client (HTTPS REST API — no TCP connection required)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase
