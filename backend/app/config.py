import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "CRM Intelligence Platform"
    
    # DB Connections
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgrespassword@localhost:5432/crm_db",
        env="DATABASE_URL"
    )
    DATABASE_SYNC_URL: str = Field(
        default="postgresql+psycopg2://postgres:postgrespassword@localhost:5432/crm_db",
        env="DATABASE_SYNC_URL"
    )
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    
    # OpenAI
    OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")
    
    # Scraping Config
    SCRAPER_CACHE_EXPIRY_HOURS: int = 6
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
