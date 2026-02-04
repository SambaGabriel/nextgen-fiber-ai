"""
NextGen Fiber AI Agent - Configuration
Enterprise-grade configuration with validation
"""

from pydantic import BaseSettings, Field
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # App
    app_name: str = "NextGen Fiber AI Agent"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", description="development|staging|production")
    debug: bool = Field(default=False)

    # API
    api_prefix: str = "/api/v1"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # AI Services
    anthropic_api_key: Optional[str] = Field(default=None, description="Claude API key")
    google_api_key: Optional[str] = Field(default=None, description="Gemini API key")

    # SmartSheets
    smartsheet_api_key: Optional[str] = Field(default=None)
    smartsheet_sheet_id: Optional[str] = Field(default=None)

    # Google Sheets
    google_credentials_path: Optional[str] = Field(default=None)

    # Logging
    log_level: str = Field(default="INFO")
    log_format: str = Field(default="json", description="json|console")

    # Business Rules
    snowshoe_min_interval_ft: int = Field(default=1000, description="Min feet between snowshoes")
    snowshoe_max_interval_ft: int = Field(default=1500, description="Max feet between snowshoes")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()
