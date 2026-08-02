"""add equipment_categories and category_id on equipment_items

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "equipment_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "equipment_items",
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("equipment_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("equipment_items", "category_id")
    op.drop_table("equipment_categories")
