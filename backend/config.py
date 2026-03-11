from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = ConfigDict(extra="ignore", env_file=".env")

    # Supabase (HTTPS REST — replaces direct TCP postgres connection)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    xai_api_key: str = ""
    chat_model: str = "grok-4-latest"

    # Gemini — used for embeddings and audio transcription
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"

    # Comma-separated extra allowed CORS origins (e.g. production Vercel URL)
    cors_origins_extra: str = ""
    rate_limit: str = "60/minute"

    @property
    def cors_origins(self) -> list[str]:
        base = [
            "http://localhost:3000",
            "http://localhost:2323",
            "http://127.0.0.1:2323",
        ]
        if self.cors_origins_extra:
            extras = [o.strip().rstrip("/") for o in self.cors_origins_extra.split(",") if o.strip()]
            base.extend(extras)
        return base


@lru_cache()
def get_settings() -> Settings:
    return Settings()
