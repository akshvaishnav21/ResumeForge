from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path

class Settings(BaseSettings):
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash"
    azure_openai_api_key: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_deployment: Optional[str] = "gpt-4o"
    database_url: str = "sqlite+aiosqlite:///./resumeforge.db"
    # Vercel Postgres auto-injects POSTGRES_URL; takes priority over database_url
    postgres_url: Optional[str] = None
    enable_validation: bool = True

    @property
    def effective_database_url(self) -> str:
        if self.postgres_url:
            # Transform postgres(ql)://... → postgresql+asyncpg://...
            url = self.postgres_url
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            # asyncpg uses ssl=require instead of sslmode=require
            url = url.replace("sslmode=require", "ssl=require")
            return url
        return self.database_url

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent / ".env")

settings = Settings()
