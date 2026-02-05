"""Initial schema with users, maps, spans, equipment, jobs, audit, feature flags

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE userrole AS ENUM ('admin', 'supervisor', 'lineman')")
    op.execute("CREATE TYPE mapstatus AS ENUM ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')")
    op.execute("CREATE TYPE jobstatusv2 AS ENUM ('assigned', 'in_progress', 'submitted', 'under_review', 'approved', 'needs_revision', 'completed', 'cancelled')")
    op.execute("CREATE TYPE worktypev2 AS ENUM ('aerial', 'underground', 'overlash', 'mixed')")

    # Users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", postgresql.ENUM("admin", "supervisor", "lineman", name="userrole", create_type=False), nullable=False, index=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("is_verified", sa.Boolean(), default=False, nullable=False),
        sa.Column("last_login_at", sa.String(50), nullable=True),
        sa.Column("last_login_ip", sa.String(45), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Maps table
    op.create_table(
        "maps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(500), unique=True, nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=True),
        sa.Column("status", postgresql.ENUM("pending", "queued", "processing", "completed", "failed", "cancelled", name="mapstatus", create_type=False), nullable=False, index=True),
        sa.Column("project_id", sa.String(100), nullable=True, index=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("fsa", sa.String(50), nullable=True),
        sa.Column("contractor", sa.String(255), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("processing_started_at", sa.String(50), nullable=True),
        sa.Column("processing_completed_at", sa.String(50), nullable=True),
        sa.Column("processing_time_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), default=0, nullable=False),
        sa.Column("overall_confidence", sa.Integer(), nullable=True),
        sa.Column("totals", postgresql.JSONB(), nullable=True),
        sa.Column("validation", postgresql.JSONB(), nullable=True),
        sa.Column("raw_extraction", postgresql.JSONB(), nullable=True),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_maps_status_created", "maps", ["status", "created_at"])
    op.create_index("ix_maps_uploaded_by_status", "maps", ["uploaded_by_id", "status"])

    # Spans table
    op.create_table(
        "spans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("length_ft", sa.Integer(), nullable=False),
        sa.Column("start_pole", sa.String(100), nullable=True),
        sa.Column("end_pole", sa.String(100), nullable=True),
        sa.Column("grid_ref", sa.String(50), nullable=True),
        sa.Column("category", sa.String(50), default="AERIAL"),
        sa.Column("cable_type", sa.String(50), nullable=True),
        sa.Column("fiber_count", sa.Integer(), nullable=True),
        sa.Column("is_long_span", sa.Boolean(), default=False),
        sa.Column("confidence", sa.Integer(), default=50),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("start_lat", sa.Float(), nullable=True),
        sa.Column("start_lng", sa.Float(), nullable=True),
        sa.Column("end_lat", sa.Float(), nullable=True),
        sa.Column("end_lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_spans_map_length", "spans", ["map_id", "length_ft"])

    # GPS Points table
    op.create_table(
        "gps_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("point_type", sa.String(50), nullable=True),
        sa.Column("confidence", sa.Integer(), default=50),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_gps_points_coords", "gps_points", ["lat", "lng"])

    # Equipment table
    op.create_table(
        "equipment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("maps.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("equipment_id", sa.String(100), nullable=True),
        sa.Column("equipment_type", sa.String(50), nullable=False),
        sa.Column("sub_type", sa.String(50), nullable=True),
        sa.Column("size", sa.String(50), nullable=True),
        sa.Column("slack_length", sa.Integer(), nullable=True),
        sa.Column("dimensions", sa.String(100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("grid_ref", sa.String(50), nullable=True),
        sa.Column("confidence", sa.Integer(), default=50),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_equipment_map_type", "equipment", ["map_id", "equipment_type"])

    # Jobs V2 table
    op.create_table(
        "jobs_v2",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("source_map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("maps.id"), nullable=True, index=True),
        sa.Column("assigned_to_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("assigned_at", sa.String(50), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("client_id", sa.String(100), nullable=True, index=True),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("work_type", postgresql.ENUM("aerial", "underground", "overlash", "mixed", name="worktypev2", create_type=False), nullable=False),
        sa.Column("location", postgresql.JSONB(), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("estimated_footage", sa.Integer(), nullable=True),
        sa.Column("actual_footage", sa.Integer(), nullable=True),
        sa.Column("status", postgresql.ENUM("assigned", "in_progress", "submitted", "under_review", "approved", "needs_revision", "completed", "cancelled", name="jobstatusv2", create_type=False), nullable=False, index=True),
        sa.Column("status_changed_at", sa.String(50), nullable=True),
        sa.Column("supervisor_notes", sa.Text(), nullable=True),
        sa.Column("lineman_notes", sa.Text(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("production_data", postgresql.JSONB(), nullable=True),
        sa.Column("map_file", postgresql.JSONB(), nullable=True),
        sa.Column("submitted_at", sa.String(50), nullable=True),
        sa.Column("approved_at", sa.String(50), nullable=True),
        sa.Column("approved_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.String(50), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_jobs_v2_assigned_status", "jobs_v2", ["assigned_to_id", "status"])
    op.create_index("ix_jobs_v2_status_created", "jobs_v2", ["status", "created_at"])
    op.create_index("ix_jobs_v2_client_status", "jobs_v2", ["client_id", "status"])

    # Audit Logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action", sa.String(50), nullable=False, index=True),
        sa.Column("entity_type", sa.String(50), nullable=True, index=True),
        sa.Column("entity_id", sa.String(100), nullable=True, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("user_role", sa.String(50), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(100), nullable=True, index=True),
        sa.Column("old_values", postgresql.JSONB(), nullable=True),
        sa.Column("new_values", postgresql.JSONB(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("is_success", sa.String(10), default="true", nullable=False),
        sa.Column("duration_ms", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_action", "audit_logs", ["user_id", "action"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_action_created", "audit_logs", ["action", "created_at"])

    # Feature Flags table
    op.create_table(
        "feature_flags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), default=False, nullable=False),
        sa.Column("rollout_percentage", sa.Integer(), default=0, nullable=False),
        sa.Column("targeted_users", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("targeted_roles", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("environments", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Insert default feature flags
    op.execute("""
        INSERT INTO feature_flags (id, name, description, is_enabled, rollout_percentage, environments)
        VALUES
            (gen_random_uuid(), 'v2_api_enabled', 'Enable V2 API endpoints with database persistence', false, 0, ARRAY['development', 'staging']),
            (gen_random_uuid(), 'postgres_persistence', 'Store data in PostgreSQL instead of localStorage', false, 0, ARRAY['development', 'staging']),
            (gen_random_uuid(), 'object_storage', 'Store files in S3/MinIO instead of base64', false, 0, ARRAY['development', 'staging']),
            (gen_random_uuid(), 'async_map_processing', 'Process maps asynchronously via worker queue', false, 0, ARRAY['development', 'staging']),
            (gen_random_uuid(), 'auto_publish_jobs', 'Auto-create jobs when map processing completes', false, 0, ARRAY['development', 'staging']),
            (gen_random_uuid(), 'redis_queue', 'Use Redis for job queuing', false, 0, ARRAY['development', 'staging'])
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("feature_flags")
    op.drop_table("audit_logs")
    op.drop_table("jobs_v2")
    op.drop_table("equipment")
    op.drop_table("gps_points")
    op.drop_table("spans")
    op.drop_table("maps")
    op.drop_table("users")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS worktypev2")
    op.execute("DROP TYPE IF EXISTS jobstatusv2")
    op.execute("DROP TYPE IF EXISTS mapstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
