"""add_inventory_operations_tables

Revision ID: c1f562c4c62f
Revises: b4f262c4c62f
Create Date: 2026-06-10 22:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1f562c4c62f'
down_revision: Union[str, Sequence[str], None] = 'b4f262c4c62f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to tenant_configs
    op.add_column('tenant_configs', sa.Column('inventory_control_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=True))
    op.add_column('tenant_configs', sa.Column('inventory_adjustment_gain_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=True))
    op.add_column('tenant_configs', sa.Column('inventory_adjustment_loss_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=True))
    op.add_column('tenant_configs', sa.Column('inventory_variance_account_id', sa.String(36), sa.ForeignKey('accounts.id'), nullable=True))

    # 2. Add columns to inventory_adjustments
    op.add_column('inventory_adjustments', sa.Column('reason_code', sa.String(50), nullable=True))
    op.add_column('inventory_adjustments', sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True))

    # 3. Add columns to inventory_transactions
    op.add_column('inventory_transactions', sa.Column('transaction_number', sa.String(50), unique=True, nullable=True))
    op.add_column('inventory_transactions', sa.Column('reference_type', sa.String(50), nullable=True))
    op.add_column('inventory_transactions', sa.Column('tenant_id', sa.String(36), nullable=True))
    # Make columns nullable for header-line pattern
    with op.batch_alter_table('inventory_transactions') as batch_op:
        batch_op.alter_column('item_id', existing_type=sa.String(36), nullable=True)
        batch_op.alter_column('quantity', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('valuation_unit_cost', existing_type=sa.Numeric(15, 2), nullable=True)

    # 4. Create inventory_transaction_lines
    op.create_table(
        'inventory_transaction_lines',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('transaction_id', sa.String(36), sa.ForeignKey('inventory_transactions.id'), nullable=False, index=True),
        sa.Column('item_id', sa.String(36), sa.ForeignKey('items.id'), nullable=False, index=True),
        sa.Column('warehouse_id', sa.String(36), sa.ForeignKey('warehouses.id'), nullable=True, index=True),
        sa.Column('batch_id', sa.String(36), sa.ForeignKey('inventory_batches.id'), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('valuation_unit_cost', sa.Numeric(18, 4), nullable=False),
        sa.Column('remarks', sa.String(255), nullable=True),
        sa.Column('tenant_id', sa.String(36), nullable=True)
    )

    # 5. Create inventory_transfers
    op.create_table(
        'inventory_transfers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('transfer_number', sa.String(50), unique=True, nullable=False),
        sa.Column('source_warehouse_id', sa.String(36), sa.ForeignKey('warehouses.id'), nullable=False, index=True),
        sa.Column('destination_warehouse_id', sa.String(36), sa.ForeignKey('warehouses.id'), nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT'),
        sa.Column('remarks', sa.String(500), nullable=True),
        sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('approved_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.String(36), nullable=True)
    )

    # 6. Create inventory_transfer_lines
    op.create_table(
        'inventory_transfer_lines',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('transfer_id', sa.String(36), sa.ForeignKey('inventory_transfers.id'), nullable=False, index=True),
        sa.Column('item_id', sa.String(36), sa.ForeignKey('items.id'), nullable=False, index=True),
        sa.Column('qty_requested', sa.Integer(), nullable=False),
        sa.Column('qty_transferred', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('qty_received', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('tenant_id', sa.String(36), nullable=True)
    )

    # 7. Create cycle_counts
    op.create_table(
        'cycle_counts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('count_number', sa.String(50), unique=True, nullable=False),
        sa.Column('warehouse_id', sa.String(36), sa.ForeignKey('warehouses.id'), nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DRAFT'),
        sa.Column('count_date', sa.DateTime(), nullable=False),
        sa.Column('remarks', sa.String(500), nullable=True),
        sa.Column('created_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('counted_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('verified_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_by_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.String(36), nullable=True)
    )

    # 8. Create cycle_count_lines
    op.create_table(
        'cycle_count_lines',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('cycle_count_id', sa.String(36), sa.ForeignKey('cycle_counts.id'), nullable=False, index=True),
        sa.Column('item_id', sa.String(36), sa.ForeignKey('items.id'), nullable=False, index=True),
        sa.Column('system_qty', sa.Integer(), nullable=False),
        sa.Column('physical_qty', sa.Integer(), nullable=True),
        sa.Column('variance_qty', sa.Integer(), nullable=True),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('tenant_id', sa.String(36), nullable=True)
    )


def downgrade() -> None:
    op.drop_table('cycle_count_lines')
    op.drop_table('cycle_counts')
    op.drop_table('inventory_transfer_lines')
    op.drop_table('inventory_transfers')
    op.drop_table('inventory_transaction_lines')
    
    with op.batch_alter_table('inventory_transactions') as batch_op:
        batch_op.alter_column('item_id', existing_type=sa.String(36), nullable=False)
        batch_op.alter_column('quantity', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('valuation_unit_cost', existing_type=sa.Numeric(15, 2), nullable=False)
        batch_op.drop_column('tenant_id')
        batch_op.drop_column('reference_type')
        batch_op.drop_column('transaction_number')

    with op.batch_alter_table('inventory_adjustments') as batch_op:
        batch_op.drop_column('created_by_id')
        batch_op.drop_column('reason_code')

    with op.batch_alter_table('tenant_configs') as batch_op:
        batch_op.drop_column('inventory_variance_account_id')
        batch_op.drop_column('inventory_adjustment_loss_account_id')
        batch_op.drop_column('inventory_adjustment_gain_account_id')
        batch_op.drop_column('inventory_control_account_id')
