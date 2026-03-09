from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase (HTTPS REST — replaces direct TCP postgres connection)
    supabase_url: str = "https://mcyppfjrftbczgpuwouu.supabase.co"
    supabase_service_role_key: str = ""

    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    chat_model: str = "gemini-2.5-flash"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:2323", "http://127.0.0.1:2323"]
    rate_limit: str = "60/minute"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
