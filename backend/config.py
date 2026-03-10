from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase (HTTPS REST — replaces direct TCP postgres connection)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    chat_model: str = "gemini-2.5-flash"

    # Comma-separated list of allowed origins (overrides defaults via env var)
    cors_origins_extra: str = ""
    rate_limit: str = "60/minute"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins(self) -> list[str]:
        base = [
            "http://localhost:3000",
            "http://localhost:2323",
            "http://127.0.0.1:2323",
        ]
        if self.cors_origins_extra:
            extras = [o.strip() for o in self.cors_origins_extra.split(",") if o.strip()]
            base.extend(extras)
        return base


@lru_cache()
def get_settings() -> Settings:
    return Settings()
