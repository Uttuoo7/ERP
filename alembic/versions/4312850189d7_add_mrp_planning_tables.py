"""add_mrp_planning_tables

Revision ID: 4312850189d7
Revises: c1f562c4c62f
Create Date: 2026-06-12 20:34:30.307143

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4312850189d7'
down_revision: Union[str, Sequence[str], None] = 'c1f562c4c62f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create demand_forecasts table
    op.create_table('demand_forecasts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('forecast_date', sa.DateTime(), nullable=False),
        sa.Column('forecast_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('forecast_method', sa.String(length=50), nullable=False),
        sa.Column('forecast_version', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demand_forecasts_forecast_date'), 'demand_forecasts', ['forecast_date'], unique=False)
    op.create_index(op.f('ix_demand_forecasts_item_id'), 'demand_forecasts', ['item_id'], unique=False)
    op.create_index(op.f('ix_demand_forecasts_tenant_id'), 'demand_forecasts', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_demand_forecasts_warehouse_id'), 'demand_forecasts', ['warehouse_id'], unique=False)

    # 2. Create safety_stock_policies table
    op.create_table('safety_stock_policies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('safety_stock_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('reorder_point_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('reorder_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('lead_time_days', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_safety_stock_policies_item_id'), 'safety_stock_policies', ['item_id'], unique=False)
    op.create_index(op.f('ix_safety_stock_policies_tenant_id'), 'safety_stock_policies', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_safety_stock_policies_warehouse_id'), 'safety_stock_policies', ['warehouse_id'], unique=False)

    # 3. Create mrp_plans table
    op.create_table('mrp_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_number', sa.String(length=50), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=True),
        sa.Column('planning_horizon_days', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('items_analyzed', sa.Integer(), nullable=False),
        sa.Column('recommendations_generated', sa.Integer(), nullable=False),
        sa.Column('total_recommended_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('run_duration_ms', sa.Integer(), nullable=False),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('generated_by_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['generated_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mrp_plans_plan_number'), 'mrp_plans', ['plan_number'], unique=True)
    op.create_index(op.f('ix_mrp_plans_tenant_id'), 'mrp_plans', ['tenant_id'], unique=False)

    # 4. Create mrp_snapshots table
    op.create_table('mrp_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_plan_id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('on_hand_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('in_transit_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('open_po_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('reserved_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('forecast_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('net_available_qty', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
        sa.ForeignKeyConstraint(['source_plan_id'], ['mrp_plans.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mrp_snapshots_item_id'), 'mrp_snapshots', ['item_id'], unique=False)
    op.create_index(op.f('ix_mrp_snapshots_source_plan_id'), 'mrp_snapshots', ['source_plan_id'], unique=False)
    op.create_index(op.f('ix_mrp_snapshots_tenant_id'), 'mrp_snapshots', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_mrp_snapshots_warehouse_id'), 'mrp_snapshots', ['warehouse_id'], unique=False)

    # 5. Modify mrp_recommendations table
    op.add_column('mrp_recommendations', sa.Column('warehouse_id', sa.UUID(), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('recommended_order_qty', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('required_date', sa.DateTime(), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('priority', sa.String(length=20), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('source_plan_id', sa.UUID(), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('estimated_unit_cost', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('estimated_total_cost', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('purchase_requisition_id', sa.UUID(), nullable=True))
    op.add_column('mrp_recommendations', sa.Column('purchase_requisition_line_id', sa.UUID(), nullable=True))


def downgrade() -> None:
    op.drop_column('mrp_recommendations', 'purchase_requisition_line_id')
    op.drop_column('mrp_recommendations', 'purchase_requisition_id')
    op.drop_column('mrp_recommendations', 'estimated_total_cost')
    op.drop_column('mrp_recommendations', 'estimated_unit_cost')
    op.drop_column('mrp_recommendations', 'source_plan_id')
    op.drop_column('mrp_recommendations', 'priority')
    op.drop_column('mrp_recommendations', 'required_date')
    op.drop_column('mrp_recommendations', 'recommended_order_qty')
    op.drop_column('mrp_recommendations', 'warehouse_id')

    op.drop_index(op.f('ix_mrp_snapshots_warehouse_id'), table_name='mrp_snapshots')
    op.drop_index(op.f('ix_mrp_snapshots_tenant_id'), table_name='mrp_snapshots')
    op.drop_index(op.f('ix_mrp_snapshots_source_plan_id'), table_name='mrp_snapshots')
    op.drop_index(op.f('ix_mrp_snapshots_item_id'), table_name='mrp_snapshots')
    op.drop_table('mrp_snapshots')
    op.drop_index(op.f('ix_mrp_plans_tenant_id'), table_name='mrp_plans')
    op.drop_index(op.f('ix_mrp_plans_plan_number'), table_name='mrp_plans')
    op.drop_table('mrp_plans')
    op.drop_index(op.f('ix_safety_stock_policies_warehouse_id'), table_name='safety_stock_policies')
    op.drop_index(op.f('ix_safety_stock_policies_tenant_id'), table_name='safety_stock_policies')
    op.drop_index(op.f('ix_safety_stock_policies_item_id'), table_name='safety_stock_policies')
    op.drop_table('safety_stock_policies')
    op.drop_index(op.f('ix_demand_forecasts_warehouse_id'), table_name='demand_forecasts')
    op.drop_index(op.f('ix_demand_forecasts_tenant_id'), table_name='demand_forecasts')
    op.drop_index(op.f('ix_demand_forecasts_item_id'), table_name='demand_forecasts')
    op.drop_index(op.f('ix_demand_forecasts_forecast_date'), table_name='demand_forecasts')
    op.drop_table('demand_forecasts')
