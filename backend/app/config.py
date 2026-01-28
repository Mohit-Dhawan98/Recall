from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/recall"

    # Security
    secret_key: str = "change-me-in-production"

    # LLM Configuration
    deepseek_api_key: str = ""
    ollama_url: str = "http://localhost:11434"

    # Application
    public_url: str = "http://localhost:3000"

    # Embedding model
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
