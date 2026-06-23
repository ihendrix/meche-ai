from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hendrix Mechanical Analytics API"
    api_prefix: str = "/api/v1"
    frontend_origins: str = "http://localhost:3000"
    frontend_origin_regex: str | None = r"https://.*\.vercel\.app"
    max_upload_mb: int = 25

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def frontend_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
