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
    app_version: str = "2.0.0"
    environment: str = Field(default="development", description="development|staging|production")
    debug: bool = Field(default=False)

    # API
    api_prefix: str = "/api/v1"
    api_v2_prefix: str = "/api/v2"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # AI Services
    anthropic_api_key: Optional[str] = Field(default=None, description="Claude API key")
    google_api_key: Optional[str] = Field(default=None, description="Gemini API key")

    # SmartSheets
    smartsheet_api_key: Optional[str] = Field(default=None)
    smartsheet_sheet_id: Optional[str] = Field(default=None)

    # Google Sheets
    google_credentials_path: Optional[str] = Field(default=None)

    # Database (PostgreSQL)
    database_url: Optional[str] = Field(
        default=None,
        description="PostgreSQL connection URL (postgresql://user:pass@host:5432/dbname)"
    )

    # Redis
    redis_url: Optional[str] = Field(
        default=None,
        description="Redis connection URL (redis://host:6379/0)"
    )

    # Object Storage (S3/MinIO)
    s3_endpoint: Optional[str] = Field(default=None, description="S3/MinIO endpoint URL")
    s3_access_key: Optional[str] = Field(default=None)
    s3_secret_key: Optional[str] = Field(default=None)
    s3_bucket: str = Field(default="fiber-maps", description="Default S3 bucket")
    s3_region: str = Field(default="us-east-1")

    # JWT Authentication
    jwt_secret: str = Field(
        default="CHANGE_ME_IN_PRODUCTION_use_openssl_rand_hex_32",
        description="JWT signing secret (use strong random value in production)"
    )
    jwt_expiry_hours: int = Field(default=8, description="Access token expiry in hours")

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
