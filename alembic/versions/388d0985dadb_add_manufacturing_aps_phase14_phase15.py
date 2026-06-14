"""add_manufacturing_aps_phase14_phase15

Phase 14 - Manufacturing Execution System (MES): BOM, Work Orders, Shop Floor, Batch Traceability
Phase 15 - Advanced Planning & Scheduling (APS): Capacity Planning, Alternates, Scenarios

Revision ID: 388d0985dadb
Revises: 4312850189d7
Create Date: 2026-06-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '388d0985dadb'
down_revision: Union[str, Sequence[str], None] = '4312850189d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Phase 14 MES and Phase 15 APS tables (idempotent — uses IF NOT EXISTS)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = inspector.get_table_names()

    # ── Phase 14A: Manufacturing Master Data ──────────────────────────────────

    if 'bill_of_materials' not in existing:
        op.create_table(
            'bill_of_materials',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('bom_number', sa.String(50), nullable=False),
            sa.Column('item_id', sa.UUID(), nullable=False),
            sa.Column('revision', sa.String(20), nullable=True),
            sa.Column('status', sa.String(20), nullable=True),
            sa.Column('effective_from', sa.DateTime(), nullable=True),
            sa.Column('effective_to', sa.DateTime(), nullable=True),
            sa.Column('uom', sa.String(20), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['item_id'], ['items.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('bom_number'),
        )

    if 'bom_lines' not in existing:
        op.create_table(
            'bom_lines',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('bom_id', sa.UUID(), nullable=False),
            sa.Column('component_item_id', sa.UUID(), nullable=False),
            sa.Column('quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('uom', sa.String(20), nullable=True),
            sa.Column('scrap_percent', sa.Numeric(5, 2), nullable=True),
            sa.Column('line_number', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['bom_id'], ['bill_of_materials.id']),
            sa.ForeignKeyConstraint(['component_item_id'], ['items.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'routings' not in existing:
        op.create_table(
            'routings',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('routing_number', sa.String(50), nullable=False),
            sa.Column('item_id', sa.UUID(), nullable=False),
            sa.Column('revision', sa.String(20), nullable=True),
            sa.Column('status', sa.String(20), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['item_id'], ['items.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('routing_number'),
        )

    if 'routing_operations' not in existing:
        op.create_table(
            'routing_operations',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('routing_id', sa.UUID(), nullable=False),
            sa.Column('sequence_no', sa.Integer(), nullable=False),
            sa.Column('operation_name', sa.String(100), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=True),
            sa.Column('setup_time_minutes', sa.Integer(), nullable=True),
            sa.Column('run_time_minutes', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['routing_id'], ['routings.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'work_centers' not in existing:
        op.create_table(
            'work_centers',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('code', sa.String(50), nullable=False),
            sa.Column('name', sa.String(150), nullable=False),
            sa.Column('available_hours_per_day', sa.Numeric(8, 4), nullable=True),
            sa.Column('efficiency_percent', sa.Numeric(6, 2), nullable=True),
            sa.Column('overtime_hours_per_day', sa.Numeric(8, 4), nullable=True),
            sa.Column('cost_per_hour', sa.Numeric(18, 4), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('code'),
        )

    if 'work_center_calendars' not in existing:
        op.create_table(
            'work_center_calendars',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=False),
            sa.Column('event_date', sa.DateTime(), nullable=False),
            sa.Column('event_type', sa.String(50), nullable=True),
            sa.Column('hours_blocked', sa.Numeric(8, 4), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['work_center_id'], ['work_centers.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    # ── Phase 14B: Work Orders ────────────────────────────────────────────────

    if 'work_orders' not in existing:
        op.create_table(
            'work_orders',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('work_order_number', sa.String(50), nullable=False),
            sa.Column('wo_number', sa.String(50), nullable=True),
            sa.Column('item_id', sa.UUID(), nullable=False),
            sa.Column('bom_id', sa.UUID(), nullable=True),
            sa.Column('routing_id', sa.UUID(), nullable=True),
            sa.Column('mrp_plan_id', sa.UUID(), nullable=True),
            sa.Column('production_order_id', sa.UUID(), nullable=True),
            sa.Column('workstation_id', sa.UUID(), nullable=True),
            sa.Column('assigned_to', sa.UUID(), nullable=True),
            sa.Column('quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('quantity_completed', sa.Numeric(18, 4), nullable=True),
            sa.Column('quantity_scrapped', sa.Numeric(18, 4), nullable=True),
            sa.Column('status', sa.String(30), nullable=True),
            sa.Column('priority', sa.String(20), nullable=True),
            sa.Column('customer_priority', sa.String(20), nullable=True),
            sa.Column('planned_start_date', sa.DateTime(), nullable=True),
            sa.Column('planned_end_date', sa.DateTime(), nullable=True),
            sa.Column('actual_start_date', sa.DateTime(), nullable=True),
            sa.Column('actual_end_date', sa.DateTime(), nullable=True),
            sa.Column('release_date', sa.DateTime(), nullable=True),
            sa.Column('close_date', sa.DateTime(), nullable=True),
            sa.Column('standard_cost', sa.Numeric(18, 4), nullable=True),
            sa.Column('actual_cost', sa.Numeric(18, 4), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['item_id'], ['items.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('work_order_number'),
        )

    if 'work_order_materials' not in existing:
        op.create_table(
            'work_order_materials',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('work_order_id', sa.UUID(), nullable=False),
            sa.Column('component_item_id', sa.UUID(), nullable=False),
            sa.Column('required_quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('issued_quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('uom', sa.String(20), nullable=True),
            sa.Column('status', sa.String(20), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['component_item_id'], ['items.id']),
            sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'work_order_operations' not in existing:
        op.create_table(
            'work_order_operations',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('work_order_id', sa.UUID(), nullable=False),
            sa.Column('sequence_no', sa.Integer(), nullable=False),
            sa.Column('operation_name', sa.String(100), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=True),
            sa.Column('setup_time_minutes', sa.Integer(), nullable=True),
            sa.Column('run_time_minutes', sa.Integer(), nullable=True),
            sa.Column('actual_start', sa.DateTime(), nullable=True),
            sa.Column('actual_end', sa.DateTime(), nullable=True),
            sa.Column('status', sa.String(20), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    # ── Phase 14D: Batch Traceability ─────────────────────────────────────────

    if 'manufacturing_batches' not in existing:
        op.create_table(
            'manufacturing_batches',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('work_order_id', sa.UUID(), nullable=False),
            sa.Column('batch_number', sa.String(80), nullable=False),
            sa.Column('produced_quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('scrap_quantity', sa.Numeric(18, 4), nullable=True),
            sa.Column('yield_percent', sa.Numeric(5, 2), nullable=True),
            sa.Column('produced_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('batch_number'),
        )

    if 'manufacturing_batch_materials' not in existing:
        op.create_table(
            'manufacturing_batch_materials',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('batch_id', sa.UUID(), nullable=False),
            sa.Column('component_item_id', sa.UUID(), nullable=False),
            sa.Column('source_batch_number', sa.String(80), nullable=True),
            sa.Column('quantity_consumed', sa.Numeric(18, 4), nullable=True),
            sa.Column('uom', sa.String(20), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['batch_id'], ['manufacturing_batches.id']),
            sa.ForeignKeyConstraint(['component_item_id'], ['items.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    # ── Phase 15A: Capacity Planning Foundation ───────────────────────────────

    if 'aps_locks' not in existing:
        op.create_table(
            'aps_locks',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.UUID(), nullable=False),
            sa.Column('is_locked', sa.Boolean(), nullable=True),
            sa.Column('lock_acquired_at', sa.DateTime(), nullable=True),
            sa.Column('lock_expires_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('tenant_id'),
        )

    if 'capacity_plans' not in existing:
        op.create_table(
            'capacity_plans',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('plan_number', sa.String(50), nullable=False),
            sa.Column('planning_start_date', sa.DateTime(), nullable=False),
            sa.Column('planning_end_date', sa.DateTime(), nullable=False),
            sa.Column('planning_horizon_days', sa.Integer(), nullable=True),
            sa.Column('scheduling_mode', sa.String(20), nullable=True),
            sa.Column('schedule_freeze_date', sa.DateTime(), nullable=True),
            sa.Column('status', sa.String(20), nullable=True),
            sa.Column('generated_at', sa.DateTime(), nullable=True),
            sa.Column('generated_by_id', sa.UUID(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['generated_by_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('plan_number'),
        )

    if 'capacity_requirements' not in existing:
        op.create_table(
            'capacity_requirements',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('capacity_plan_id', sa.UUID(), nullable=False),
            sa.Column('work_order_id', sa.UUID(), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=False),
            sa.Column('operation_id', sa.UUID(), nullable=True),
            sa.Column('required_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('scheduled_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('remaining_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('available_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('utilization_percent', sa.Numeric(6, 2), nullable=True),
            sa.Column('overload_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['capacity_plan_id'], ['capacity_plans.id']),
            sa.ForeignKeyConstraint(['work_center_id'], ['work_centers.id']),
            sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'capacity_calendars' not in existing:
        op.create_table(
            'capacity_calendars',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('capacity_plan_id', sa.UUID(), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('available_hours', sa.Numeric(8, 4), nullable=True),
            sa.Column('planned_hours', sa.Numeric(8, 4), nullable=True),
            sa.Column('blocked_hours', sa.Numeric(8, 4), nullable=True),
            sa.Column('overtime_hours', sa.Numeric(8, 4), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['capacity_plan_id'], ['capacity_plans.id']),
            sa.ForeignKeyConstraint(['work_center_id'], ['work_centers.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('capacity_plan_id', 'work_center_id', 'date', name='uq_plan_wc_date'),
        )

    if 'capacity_exceptions' not in existing:
        op.create_table(
            'capacity_exceptions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('capacity_plan_id', sa.UUID(), nullable=False),
            sa.Column('work_center_id', sa.UUID(), nullable=False),
            sa.Column('exception_type', sa.String(50), nullable=True),
            sa.Column('exception_date', sa.DateTime(), nullable=True),
            sa.Column('severity', sa.String(20), nullable=True),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('impact_hours', sa.Numeric(12, 4), nullable=True),
            sa.Column('late_days', sa.Integer(), nullable=True),
            sa.Column('resolved', sa.Boolean(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['capacity_plan_id'], ['capacity_plans.id']),
            sa.ForeignKeyConstraint(['work_center_id'], ['work_centers.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'work_center_alternates' not in existing:
        op.create_table(
            'work_center_alternates',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('primary_work_center_id', sa.UUID(), nullable=False),
            sa.Column('alternate_work_center_id', sa.UUID(), nullable=False),
            sa.Column('priority', sa.Integer(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['alternate_work_center_id'], ['work_centers.id']),
            sa.ForeignKeyConstraint(['primary_work_center_id'], ['work_centers.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'planning_scenarios' not in existing:
        op.create_table(
            'planning_scenarios',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('capacity_plan_id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('scenario_type', sa.String(30), nullable=True),
            sa.Column('created_by_id', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('tenant_id', sa.UUID(), nullable=True),
            sa.Column('is_deleted', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['capacity_plan_id'], ['capacity_plans.id']),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    """Drop Phase 14/15 tables in dependency order."""
    op.drop_table('planning_scenarios')
    op.drop_table('work_center_alternates')
    op.drop_table('capacity_exceptions')
    op.drop_table('capacity_calendars')
    op.drop_table('capacity_requirements')
    op.drop_table('capacity_plans')
    op.drop_table('aps_locks')
    op.drop_table('manufacturing_batch_materials')
    op.drop_table('manufacturing_batches')
    op.drop_table('work_order_operations')
    op.drop_table('work_order_materials')
    op.drop_table('work_orders')
    op.drop_table('work_center_calendars')
    op.drop_table('work_center_alternates')
    op.drop_table('work_centers')
    op.drop_table('routing_operations')
    op.drop_table('routings')
    op.drop_table('bom_lines')
    op.drop_table('bill_of_materials')
