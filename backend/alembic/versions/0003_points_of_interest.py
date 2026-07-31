"""add points_of_interest table

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "points_of_interest",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hike_id", sa.Integer(), sa.ForeignKey("hikes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("points_of_interest")
