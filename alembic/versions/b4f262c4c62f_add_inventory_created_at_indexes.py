"""add_inventory_created_at_indexes

Revision ID: b4f262c4c62f
Revises: a511aef81f46
Create Date: 2026-06-10 22:13:14.212142

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4f262c4c62f'
down_revision: Union[str, Sequence[str], None] = 'a511aef81f46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_inventory_cost_layers_created_at'), 'inventory_cost_layers', ['created_at'], unique=False)
    op.create_index(op.f('ix_inventory_valuation_entries_created_at'), 'inventory_valuation_entries', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_inventory_valuation_entries_created_at'), table_name='inventory_valuation_entries')
    op.drop_index(op.f('ix_inventory_cost_layers_created_at'), table_name='inventory_cost_layers')
