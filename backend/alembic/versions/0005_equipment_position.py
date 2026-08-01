"""add position to equipment_items

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipment_items", sa.Column("position", sa.Integer(), nullable=False, server_default="0"))
    # Ordre initial cohérent pour les items déjà existants (par id de création).
    op.execute("UPDATE equipment_items SET position = id")


def downgrade() -> None:
    op.drop_column("equipment_items", "position")
