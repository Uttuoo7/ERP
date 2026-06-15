"""add_missing_user_columns

Revision ID: e613b88dcd4f
Revises: 388d0985dadb
Create Date: 2026-06-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e613b88dcd4f'
down_revision: Union[str, Sequence[str], None] = '388d0985dadb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get database inspector
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    if 'company_id' not in columns:
        op.add_column('users', sa.Column('company_id', sa.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=True))
    if 'branch_id' not in columns:
        op.add_column('users', sa.Column('branch_id', sa.UUID(as_uuid=True), sa.ForeignKey('branches.id'), nullable=True))
    if 'vendor_id' not in columns:
        op.add_column('users', sa.Column('vendor_id', sa.UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    if 'company_id' in columns:
        op.drop_column('users', 'company_id')
    if 'branch_id' in columns:
        op.drop_column('users', 'branch_id')
    if 'vendor_id' in columns:
        op.drop_column('users', 'vendor_id')
