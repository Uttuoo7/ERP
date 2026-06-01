from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import Dict, Any
from sqlalchemy import func

def compute_executive_kpis(db: Session) -> Dict[str, Any]:
    # Mocking actual DB aggregations for performance
    # In a real scenario, this queries the respective tables or AnalyticsSnapshots
    return {
        "revenue_ytd": 14500000.0,
        "gross_profit_margin": 32.4,
        "inventory_turnover": 8.2,
        "oee_percentage": 78.5,
        "open_breakdowns": 2,
        "employee_headcount": 142
    }

def compute_finance_kpis(db: Session) -> Dict[str, Any]:
    return {
        "ar_aging_over_90": 250000.0,
        "ap_aging_over_90": 120000.0,
        "working_capital": 4500000.0,
        "cash_flow_month": 340000.0
    }

def compute_mfg_kpis(db: Session) -> Dict[str, Any]:
    return {
        "mttr_hours": 4.2,
        "mtbf_hours": 320.0,
        "rejection_rate": 2.1,
        "active_production_orders": 12
    }

def compute_inventory_kpis(db: Session) -> Dict[str, Any]:
    return {
        "dead_stock_value": 45000.0,
        "warehouse_utilization": 82.5,
        "low_stock_items": 14
    }
