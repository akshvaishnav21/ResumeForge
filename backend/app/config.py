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
    enable_validation: bool = True

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent / ".env")

settings = Settings()
