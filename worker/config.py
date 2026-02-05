"""
Worker Configuration
Environment-based configuration for the worker service
"""

import os
from typing import Optional
from pydantic import BaseSettings, Field


class WorkerSettings(BaseSettings):
    """Worker service settings."""

    # Service identity
    worker_name: str = Field(default="map-worker-01", env="WORKER_NAME")
    environment: str = Field(default="development", env="ENVIRONMENT")

    # Database
    database_url: str = Field(..., env="DATABASE_URL")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")

    # Object Storage (S3/MinIO)
    s3_endpoint: str = Field(default="http://localhost:9000", env="S3_ENDPOINT")
    s3_access_key: str = Field(..., env="S3_ACCESS_KEY")
    s3_secret_key: str = Field(..., env="S3_SECRET_KEY")
    s3_bucket: str = Field(default="fiber-maps", env="S3_BUCKET")
    s3_region: str = Field(default="us-east-1", env="S3_REGION")

    # Claude API
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")

    # Processing settings
    max_concurrent_jobs: int = Field(default=3, env="MAX_CONCURRENT_JOBS")
    job_timeout_seconds: int = Field(default=300, env="JOB_TIMEOUT_SECONDS")  # 5 minutes
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    retry_delay_seconds: int = Field(default=5, env="RETRY_DELAY_SECONDS")

    # Circuit breaker settings
    circuit_breaker_failures: int = Field(default=5, env="CIRCUIT_BREAKER_FAILURES")
    circuit_breaker_recovery_seconds: int = Field(default=60, env="CIRCUIT_BREAKER_RECOVERY_SECONDS")

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Callbacks
    api_base_url: Optional[str] = Field(default=None, env="API_BASE_URL")
    api_callback_token: Optional[str] = Field(default=None, env="API_CALLBACK_TOKEN")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


def get_worker_settings() -> WorkerSettings:
    """Get worker settings instance."""
    return WorkerSettings()
