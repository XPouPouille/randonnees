"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-30

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "hikes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.String(50), nullable=True),
        sa.Column("duration_hint", sa.String(50), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("elevation_gain_m", sa.Float(), nullable=True),
        sa.Column("elevation_loss_m", sa.Float(), nullable=True),
        sa.Column("start_lat", sa.Float(), nullable=True),
        sa.Column("start_lon", sa.Float(), nullable=True),
        sa.Column("geom", geoalchemy2.Geometry(geometry_type="LINESTRING", srid=4326), nullable=True),
        sa.Column("elevation_profile", sa.JSON(), nullable=True),
        sa.Column("gpx_filename", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "external_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hike_id", sa.Integer(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("label", sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("external_links")
    op.drop_table("hikes")
    op.execute("DROP EXTENSION IF EXISTS postgis")
