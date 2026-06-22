"""add users created_at

Revision ID: 634f314dbe98
Revises: e613b88dcd4f
Create Date: 2026-06-22 23:59:06.162396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '634f314dbe98'
down_revision: Union[str, Sequence[str], None] = 'e613b88dcd4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get database inspector
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('users')]
    dialect = bind.dialect.name
    
    if 'created_at' not in columns:
        op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=True))
    if 'is_deleted' not in columns:
        default_val = sa.text('false') if dialect == 'postgresql' else sa.text('0')
        op.add_column('users', sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default=default_val))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    if 'created_at' in columns:
        op.drop_column('users', 'created_at')
    if 'is_deleted' in columns:
        op.drop_column('users', 'is_deleted')
