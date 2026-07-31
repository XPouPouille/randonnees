"""add activity_type and notes to hikes

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hikes",
        sa.Column("activity_type", sa.String(20), nullable=False, server_default="rando"),
    )
    op.add_column("hikes", sa.Column("notes", sa.Text(), nullable=True))

    # Les randonnées importées avec le préfixe "[Vélo] " (voir import_recto_verso.py)
    # sont reclassées via le nouveau champ activity_type, préfixe retiré du nom.
    op.execute(
        r"""
        UPDATE hikes
        SET activity_type = 'velo',
            name = regexp_replace(name, '^\[Vélo\] ', '')
        WHERE name LIKE '[Vélo]%'
        """
    )


def downgrade() -> None:
    op.drop_column("hikes", "notes")
    op.drop_column("hikes", "activity_type")
