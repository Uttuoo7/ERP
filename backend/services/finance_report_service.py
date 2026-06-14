import uuid
import os
import json
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from backend import models
from backend.services.ledger_service import LedgerService

class FinanceReportService:
    """
    Business logic for financial reporting: Balance Sheet, Profit & Loss, Cash Flow,
    AP Reconciliation, GRNI Reconciliation, and Finance Health Dashboard.
    Supports excluding test/seed records dynamically via seed_data_registry.json.
    """

    @staticmethod
    def _get_excluded_ids() -> Dict[str, Set[uuid.UUID]]:
        root_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        registry_path = os.path.join(root_path, "seed_data_registry.json")
        excluded = {
            "journal_entries": set(),
            "grns": set(),
            "invoices": set(),
            "payments": set(),
            "vendor_liabilities": set()
        }
        if os.path.exists(registry_path):
            try:
                with open(registry_path, "r") as f:
                    data = json.load(f)
                    for cat in ["factory_seed", "test", "audit"]:
                        if cat in data:
                            for key in excluded.keys():
                                if key in data[cat]:
                                    excluded[key].update(uuid.UUID(x) for x in data[cat][key])
            except Exception:
                pass
        return excluded

    @staticmethod
    def _parse_date(d: Any) -> Optional[datetime]:
        if not d:
            return None
        if isinstance(d, datetime):
            return d
        if isinstance(d, str):
            # Try parsing different ISO formats
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%S.%f"):
                try:
                    return datetime.strptime(d.split('+')[0], fmt)
                except ValueError:
                    continue
        return None

    @staticmethod
    def get_account_balances_as_of(db: Session, as_of_date: Optional[datetime] = None) -> Dict[str, Decimal]:
        """
        Calculates the net balance of all accounts as of a specific date.
        """
        accounts = db.query(models.Account).filter(models.Account.is_deleted == False).all()
        balances = {}
        excluded_ids = FinanceReportService._get_excluded_ids()

        for acc in accounts:
            debit_query = db.query(func.sum(models.JournalLine.debit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            credit_query = db.query(func.sum(models.JournalLine.credit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )

            if excluded_ids["journal_entries"]:
                debit_query = debit_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
                credit_query = credit_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))

            if as_of_date:
                debit_query = debit_query.filter(models.JournalEntry.entry_date <= as_of_date)
                credit_query = credit_query.filter(models.JournalEntry.entry_date <= as_of_date)

            debit_sum = debit_query.scalar() or Decimal("0.0")
            credit_sum = credit_query.scalar() or Decimal("0.0")

            is_debit_type = acc.account_type.upper() in ["ASSET", "EXPENSE"]
            if is_debit_type:
                balances[acc.code] = debit_sum - credit_sum
            else:
                balances[acc.code] = credit_sum - debit_sum

        return balances

    @staticmethod
    def get_net_income_up_to(balances: Dict[str, Decimal]) -> Decimal:
        """
        Helper to calculate Net Income up to a date from a dict of balances.
        Net Income = Revenue - Expenses
        """
        net_income = Decimal("0.0")
        for code, bal in balances.items():
            if code.startswith("4"):
                net_income += bal
            elif code.startswith("5") or code.startswith("6"):
                net_income -= bal
        return net_income

    @staticmethod
    def get_balance_sheet(db: Session, as_of_date_str: Optional[str] = None, comparison_date_str: Optional[str] = None) -> Dict[str, Any]:
        as_of_date = db.query(models.JournalEntry.entry_date).order_by(models.JournalEntry.entry_date.desc()).first()
        as_of_date = as_of_date[0] if as_of_date else datetime.utcnow()
        if as_of_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date <= datetime.strptime(as_of_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.desc()).first()
            as_of_date = parsed[0] if parsed else datetime.strptime(as_of_date_str, "%Y-%m-%d")

        comparison_date = as_of_date - timedelta(days=365)
        if comparison_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date <= datetime.strptime(comparison_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.desc()).first()
            comparison_date = parsed[0] if parsed else datetime.strptime(comparison_date_str, "%Y-%m-%d")

        excluded_ids = FinanceReportService._get_excluded_ids()

        curr_balances_query = db.query(
            models.Account.code,
            models.Account.name,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date <= as_of_date
        )

        prev_balances_query = db.query(
            models.Account.code,
            models.Account.name,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date <= comparison_date
        )

        if excluded_ids["journal_entries"]:
            curr_balances_query = curr_balances_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            prev_balances_query = prev_balances_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))

        curr_balances = curr_balances_query.group_by(models.Account.code, models.Account.name, models.Account.account_type).all()
        prev_balances = prev_balances_query.group_by(models.Account.code, models.Account.name, models.Account.account_type).all()

        curr_bal_dict = {}
        for row in curr_balances:
            is_debit = row.account_type.upper() in ["ASSET", "EXPENSE"]
            curr_bal_dict[row.code] = (row.debit - row.credit) if is_debit else (row.credit - row.debit)

        prev_bal_dict = {}
        for row in prev_balances:
            is_debit = row.account_type.upper() in ["ASSET", "EXPENSE"]
            prev_bal_dict[row.code] = (row.debit - row.credit) if is_debit else (row.credit - row.debit)

        accounts = db.query(models.Account).filter(models.Account.is_deleted == False).all()
        for acc in accounts:
            if acc.code not in curr_bal_dict:
                curr_bal_dict[acc.code] = Decimal("0.0")
            if acc.code not in prev_bal_dict:
                prev_bal_dict[acc.code] = Decimal("0.0")

        curr_net_income = Decimal("0.0")
        prev_net_income = Decimal("0.0")
        for code in list(curr_bal_dict.keys()):
            if code.startswith("4"):
                curr_net_income += curr_bal_dict[code]
                curr_bal_dict[code] = Decimal("0.0")
            elif code.startswith("5") or code.startswith("6"):
                curr_net_income -= curr_bal_dict[code]
                curr_bal_dict[code] = Decimal("0.0")

        for code in list(prev_bal_dict.keys()):
            if code.startswith("4"):
                prev_net_income += prev_bal_dict[code]
                prev_bal_dict[code] = Decimal("0.0")
            elif code.startswith("5") or code.startswith("6"):
                prev_net_income -= prev_bal_dict[code]
                prev_bal_dict[code] = Decimal("0.0")

        assets_section = []
        liabilities_section = []
        equity_section = []

        total_assets = Decimal("0.0")
        prev_total_assets = Decimal("0.0")
        total_liabilities = Decimal("0.0")
        prev_total_liabilities = Decimal("0.0")
        total_equity = Decimal("0.0")
        prev_total_equity = Decimal("0.0")

        for acc in accounts:
            if acc.account_type.upper() == "ASSET":
                val = curr_bal_dict.get(acc.code, Decimal("0.0"))
                pval = prev_bal_dict.get(acc.code, Decimal("0.0"))
                assets_section.append({
                    "id": str(acc.id),
                    "code": acc.code,
                    "name": acc.name,
                    "balance": float(val),
                    "prev_balance": float(pval),
                    "variance": float(val - pval)
                })
                total_assets += val
                prev_total_assets += pval

            elif acc.account_type.upper() == "LIABILITY":
                val = curr_bal_dict.get(acc.code, Decimal("0.0"))
                pval = prev_bal_dict.get(acc.code, Decimal("0.0"))
                liabilities_section.append({
                    "id": str(acc.id),
                    "code": acc.code,
                    "name": acc.name,
                    "balance": float(val),
                    "prev_balance": float(pval),
                    "variance": float(val - pval)
                })
                total_liabilities += val
                prev_total_liabilities += pval

            elif acc.account_type.upper() == "EQUITY":
                val = curr_bal_dict.get(acc.code, Decimal("0.0"))
                pval = prev_bal_dict.get(acc.code, Decimal("0.0"))
                if acc.code == "3100":
                    val += curr_net_income
                    pval += prev_net_income

                equity_section.append({
                    "id": str(acc.id),
                    "code": acc.code,
                    "name": acc.name,
                    "balance": float(val),
                    "prev_balance": float(pval),
                    "variance": float(val - pval)
                })
                total_equity += val
                prev_total_equity += pval

        difference = abs(total_assets - (total_liabilities + total_equity))
        balanced = difference < Decimal("0.01")

        return {
            "as_of_date": as_of_date.isoformat(),
            "comparison_date": comparison_date.isoformat(),
            "assets": assets_section,
            "liabilities": liabilities_section,
            "equity": equity_section,
            "total_assets": float(total_assets),
            "prev_total_assets": float(prev_total_assets),
            "total_liabilities": float(total_liabilities),
            "prev_total_liabilities": float(prev_total_liabilities),
            "total_equity": float(total_equity),
            "prev_total_equity": float(prev_total_equity),
            "assets_equals_liabilities_plus_equity": balanced,
            "difference": float(difference)
        }

    @staticmethod
    def get_profit_and_loss(db: Session, start_date_str: Optional[str] = None, end_date_str: Optional[str] = None, comparison_start_str: Optional[str] = None, comparison_end_str: Optional[str] = None) -> Dict[str, Any]:
        end_date = db.query(models.JournalEntry.entry_date).order_by(models.JournalEntry.entry_date.desc()).first()
        end_date = end_date[0] if end_date else datetime.utcnow()
        if end_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date <= datetime.strptime(end_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.desc()).first()
            end_date = parsed[0] if parsed else datetime.strptime(end_date_str, "%Y-%m-%d")

        start_date = end_date - timedelta(days=30)
        if start_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date >= datetime.strptime(start_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.asc()).first()
            start_date = parsed[0] if parsed else datetime.strptime(start_date_str, "%Y-%m-%d")

        comp_end = start_date
        if comparison_end_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date <= datetime.strptime(comparison_end_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.desc()).first()
            comp_end = parsed[0] if parsed else datetime.strptime(comparison_end_str, "%Y-%m-%d")

        comp_start = comp_end - timedelta(days=30)
        if comparison_start_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date >= datetime.strptime(comparison_start_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.asc()).first()
            comp_start = parsed[0] if parsed else datetime.strptime(comparison_start_str, "%Y-%m-%d")

        excluded_ids = FinanceReportService._get_excluded_ids()

        curr_changes_query = db.query(
            models.Account.code,
            models.Account.name,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date >= start_date,
            models.JournalEntry.entry_date <= end_date
        )

        prev_changes_query = db.query(
            models.Account.code,
            models.Account.name,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date >= comp_start,
            models.JournalEntry.entry_date <= comp_end
        )

        if excluded_ids["journal_entries"]:
            curr_changes_query = curr_changes_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            prev_changes_query = prev_changes_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))

        curr_changes = curr_changes_query.group_by(models.Account.code, models.Account.name, models.Account.account_type).all()
        prev_changes = prev_changes_query.group_by(models.Account.code, models.Account.name, models.Account.account_type).all()

        curr_change_dict = {}
        for row in curr_changes:
            is_debit = row.account_type.upper() in ["ASSET", "EXPENSE"]
            curr_change_dict[row.code] = (row.debit - row.credit) if is_debit else (row.credit - row.debit)

        prev_change_dict = {}
        for row in prev_changes:
            is_debit = row.account_type.upper() in ["ASSET", "EXPENSE"]
            prev_change_dict[row.code] = (row.debit - row.credit) if is_debit else (row.credit - row.debit)

        accounts = db.query(models.Account).filter(models.Account.is_deleted == False).all()
        for acc in accounts:
            if acc.code not in curr_change_dict:
                curr_change_dict[acc.code] = Decimal("0.0")
            if acc.code not in prev_change_dict:
                prev_change_dict[acc.code] = Decimal("0.0")

        revenue_section = []
        cogs_section = []
        expenses_section = []

        total_revenue = Decimal("0.0")
        prev_total_revenue = Decimal("0.0")
        total_cogs = Decimal("0.0")
        prev_total_cogs = Decimal("0.0")
        total_expenses = Decimal("0.0")
        prev_total_expenses = Decimal("0.0")

        for acc in accounts:
            if acc.account_type.upper() == "REVENUE":
                val = curr_change_dict.get(acc.code, Decimal("0.0"))
                pval = prev_change_dict.get(acc.code, Decimal("0.0"))
                revenue_section.append({
                    "id": str(acc.id),
                    "code": acc.code,
                    "name": acc.name,
                    "amount": float(val),
                    "prev_amount": float(pval),
                    "variance": float(val - pval)
                })
                total_revenue += val
                prev_total_revenue += pval

            elif acc.account_type.upper() == "EXPENSE":
                val = curr_change_dict.get(acc.code, Decimal("0.0"))
                pval = prev_change_dict.get(acc.code, Decimal("0.0"))
                if acc.code == "5000":
                    cogs_section.append({
                        "id": str(acc.id),
                        "code": acc.code,
                        "name": acc.name,
                        "amount": float(val),
                        "prev_amount": float(pval),
                        "variance": float(val - pval)
                    })
                    total_cogs += val
                    prev_total_cogs += pval
                else:
                    expenses_section.append({
                        "id": str(acc.id),
                        "code": acc.code,
                        "name": acc.name,
                        "amount": float(val),
                        "prev_amount": float(pval),
                        "variance": float(val - pval)
                    })
                    total_expenses += val
                    prev_total_expenses += pval

        gross_profit = total_revenue - total_cogs
        prev_gross_profit = prev_total_revenue - prev_total_cogs
        gross_profit_variance = gross_profit - prev_gross_profit

        net_profit = gross_profit - total_expenses
        prev_net_profit = prev_gross_profit - prev_total_expenses
        net_profit_variance = net_profit - prev_net_profit

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "comparison_start": comp_start.isoformat(),
            "comparison_end": comp_end.isoformat(),
            "revenue": revenue_section,
            "cogs": cogs_section,
            "expenses": expenses_section,
            "total_revenue": float(total_revenue),
            "prev_total_revenue": float(prev_total_revenue),
            "total_cogs": float(total_cogs),
            "prev_total_cogs": float(prev_total_cogs),
            "gross_profit": float(gross_profit),
            "prev_gross_profit": float(prev_gross_profit),
            "gross_profit_variance": float(gross_profit_variance),
            "total_expenses": float(total_expenses),
            "prev_total_expenses": float(prev_total_expenses),
            "net_profit": float(net_profit),
            "prev_net_profit": float(prev_net_profit),
            "net_profit_variance": float(net_profit_variance)
        }

    @staticmethod
    def get_cash_flow(db: Session, start_date_str: Optional[str] = None, end_date_str: Optional[str] = None) -> Dict[str, Any]:
        end_date = db.query(models.JournalEntry.entry_date).order_by(models.JournalEntry.entry_date.desc()).first()
        end_date = end_date[0] if end_date else datetime.utcnow()
        if end_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date <= datetime.strptime(end_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.desc()).first()
            end_date = parsed[0] if parsed else datetime.strptime(end_date_str, "%Y-%m-%d")

        start_date = end_date - timedelta(days=30)
        if start_date_str:
            parsed = db.query(models.JournalEntry.entry_date).filter(models.JournalEntry.entry_date >= datetime.strptime(start_date_str, "%Y-%m-%d")).order_by(models.JournalEntry.entry_date.asc()).first()
            start_date = parsed[0] if parsed else datetime.strptime(start_date_str, "%Y-%m-%d")

        p_and_l = FinanceReportService.get_profit_and_loss(db, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
        net_profit = Decimal(str(p_and_l["net_profit"]))

        accounts = db.query(models.Account).filter(models.Account.is_deleted == False).all()
        excluded_ids = FinanceReportService._get_excluded_ids()

        bal_start_query = db.query(
            models.Account.code,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date < start_date
        )

        bal_end_query = db.query(
            models.Account.code,
            models.Account.account_type,
            func.sum(models.JournalLine.debit_amount).label("debit"),
            func.sum(models.JournalLine.credit_amount).label("credit")
        ).join(models.JournalLine, models.JournalLine.account_id == models.Account.id).join(
            models.JournalEntry, models.JournalEntry.id == models.JournalLine.journal_entry_id
        ).filter(
            models.JournalEntry.status != "DRAFT",
            models.JournalLine.is_deleted == False,
            models.JournalEntry.entry_date <= end_date
        )

        if excluded_ids["journal_entries"]:
            bal_start_query = bal_start_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            bal_end_query = bal_end_query.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))

        bal_start = bal_start_query.group_by(models.Account.code, models.Account.account_type).all()
        bal_end = bal_end_query.group_by(models.Account.code, models.Account.account_type).all()

        start_dict = {}
        for r in bal_start:
            is_deb = r.account_type.upper() in ["ASSET", "EXPENSE"]
            start_dict[r.code] = (r.debit - r.credit) if is_deb else (r.credit - r.debit)

        end_dict = {}
        for r in bal_end:
            is_deb = r.account_type.upper() in ["ASSET", "EXPENSE"]
            end_dict[r.code] = (r.debit - r.credit) if is_deb else (r.credit - r.debit)

        for a in accounts:
            if a.code not in start_dict:
                start_dict[a.code] = Decimal("0.0")
            if a.code not in end_dict:
                end_dict[a.code] = Decimal("0.0")

        wc_adjustments = []
        operating_wc_change = Decimal("0.0")

        for a in accounts:
            if a.code.startswith("1") and a.code != "1000" and a.account_type.upper() == "ASSET":
                diff = end_dict[a.code] - start_dict[a.code]
                if diff != 0:
                    wc_adjustments.append({
                        "account_code": a.code,
                        "account_name": a.name,
                        "change_type": "ASSET",
                        "change_amount": float(diff),
                        "impact_on_cash": float(-diff)
                    })
                    operating_wc_change -= diff

            elif a.code.startswith("2") and a.account_type.upper() == "LIABILITY":
                diff = end_dict[a.code] - start_dict[a.code]
                if diff != 0:
                    wc_adjustments.append({
                        "account_code": a.code,
                        "account_name": a.name,
                        "change_type": "LIABILITY",
                        "change_amount": float(diff),
                        "impact_on_cash": float(diff)
                    })
                    operating_wc_change += diff

        operating_cash_flow = net_profit + operating_wc_change

        financing_adjustments = []
        financing_cash_flow = Decimal("0.0")
        for a in accounts:
            if a.account_type.upper() == "EQUITY" and a.code != "3100":
                diff = end_dict[a.code] - start_dict[a.code]
                if diff != 0:
                    financing_adjustments.append({
                        "account_code": a.code,
                        "account_name": a.name,
                        "change_amount": float(diff),
                        "impact_on_cash": float(diff)
                    })
                    financing_cash_flow += diff

        investing_cash_flow = Decimal("0.0")

        net_cash_movement = operating_cash_flow + investing_cash_flow + financing_cash_flow

        opening_cash = start_dict.get("1000", Decimal("0.0"))
        closing_cash = end_dict.get("1000", Decimal("0.0"))

        difference = abs((opening_cash + net_cash_movement) - closing_cash)
        balanced = difference < Decimal("0.01")

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "net_profit": float(net_profit),
            "working_capital_adjustments": wc_adjustments,
            "operating_wc_change": float(operating_wc_change),
            "operating_cash_flow": float(operating_cash_flow),
            "investing_cash_flow": float(investing_cash_flow),
            "financing_adjustments": financing_adjustments,
            "financing_cash_flow": float(financing_cash_flow),
            "net_cash_movement": float(net_cash_movement),
            "opening_cash": float(opening_cash),
            "closing_cash": float(closing_cash),
            "reconciliation_balanced": balanced,
            "difference": float(difference)
        }

    @staticmethod
    def get_ap_reconciliation(db: Session) -> Dict[str, Any]:
        """
        Compares AP GL account balance with Vendor Liabilities subledger.
        """
        excluded_ids = FinanceReportService._get_excluded_ids()
        ap_acc = db.query(models.Account).filter(models.Account.code == "2000").first()
        gl_balance = Decimal("0.0")
        if ap_acc:
            debit_sum = db.query(func.sum(models.JournalLine.debit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == ap_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            credit_sum = db.query(func.sum(models.JournalLine.credit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == ap_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            if excluded_ids["journal_entries"]:
                debit_sum = debit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
                credit_sum = credit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            gl_balance = (credit_sum.scalar() or Decimal("0.0")) - (debit_sum.scalar() or Decimal("0.0"))

        # Subledger outstanding
        subledger_query = db.query(func.sum(models.VendorLiability.outstanding_amount))
        if excluded_ids["vendor_liabilities"]:
            subledger_query = subledger_query.filter(~models.VendorLiability.id.in_(list(excluded_ids["vendor_liabilities"])))
        subledger_total = subledger_query.scalar() or Decimal("0.0")

        # Details by vendor
        vendor_liabs_query = db.query(
            models.Vendor.id,
            models.Vendor.name,
            func.sum(models.VendorLiability.original_amount).label("original"),
            func.sum(models.VendorLiability.outstanding_amount).label("outstanding")
        ).join(models.VendorLiability)
        if excluded_ids["vendor_liabilities"]:
            vendor_liabs_query = vendor_liabs_query.filter(~models.VendorLiability.id.in_(list(excluded_ids["vendor_liabilities"])))
        vendor_liabs = vendor_liabs_query.group_by(models.Vendor.id, models.Vendor.name).all()

        vendor_details = []
        for row in vendor_liabs:
            # Get individual invoices for this vendor
            invoices_query = db.query(models.VendorLiability).filter(
                models.VendorLiability.vendor_id == row.id
            )
            if excluded_ids["vendor_liabilities"]:
                invoices_query = invoices_query.filter(~models.VendorLiability.id.in_(list(excluded_ids["vendor_liabilities"])))
            invoices = invoices_query.all()
            
            inv_list = []
            for item in invoices:
                inv_list.append({
                    "liability_id": str(item.id),
                    "invoice_number": item.invoice.invoice_number,
                    "invoice_date": item.invoice.invoice_date.isoformat(),
                    "due_date": item.due_date.isoformat(),
                    "original_amount": float(item.original_amount),
                    "outstanding_amount": float(item.outstanding_amount),
                    "status": item.status
                })

            vendor_details.append({
                "vendor_id": str(row.id),
                "vendor_name": row.name,
                "original_amount": float(row.original or 0.0),
                "outstanding_amount": float(row.outstanding or 0.0),
                "invoices": inv_list
            })

        difference = gl_balance - subledger_total

        return {
            "gl_balance": float(gl_balance),
            "subledger_balance": float(subledger_total),
            "difference": float(difference),
            "status": "MATCHED" if abs(difference) < Decimal("0.01") else "MISMATCH",
            "vendors": vendor_details
        }

    @staticmethod
    def get_grni_reconciliation(db: Session) -> Dict[str, Any]:
        """
        Compares GRNI GL account balance with Uninvoiced GRNs subledger.
        """
        excluded_ids = FinanceReportService._get_excluded_ids()
        grni_acc = db.query(models.Account).filter(models.Account.code == "2100").first()
        gl_balance = Decimal("0.0")
        if grni_acc:
            debit_sum = db.query(func.sum(models.JournalLine.debit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == grni_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            credit_sum = db.query(func.sum(models.JournalLine.credit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == grni_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            if excluded_ids["journal_entries"]:
                debit_sum = debit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
                credit_sum = credit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            gl_balance = (credit_sum.scalar() or Decimal("0.0")) - (debit_sum.scalar() or Decimal("0.0"))

        # Query all approved/completed GRNs
        grns_query = db.query(models.GoodsReceiptNote).filter(
            models.GoodsReceiptNote.status.in_(["APPROVED", "COMPLETED"])
        )
        if excluded_ids["grns"]:
            grns_query = grns_query.filter(~models.GoodsReceiptNote.id.in_(list(excluded_ids["grns"])))
        all_grns = grns_query.all()

        uninvoiced_grns = []
        subledger_total = Decimal("0.0")

        for g in all_grns:
            # Check if invoiced
            inv_query = db.query(models.Invoice).filter(models.Invoice.grn_id == g.id)
            if excluded_ids["invoices"]:
                inv_query = inv_query.filter(~models.Invoice.id.in_(list(excluded_ids["invoices"])))
            inv = inv_query.first()
            if not inv:
                uninvoiced_grns.append({
                    "grn_id": str(g.id),
                    "grn_number": g.grn_number,
                    "po_number": g.purchase_order.po_number if g.purchase_order else "N/A",
                    "vendor_name": g.vendor.name if g.vendor else "N/A",
                    "receipt_date": g.receipt_date.isoformat(),
                    "amount": float(g.subtotal)
                })
                subledger_total += g.subtotal

        difference = gl_balance - subledger_total

        return {
            "gl_balance": float(gl_balance),
            "subledger_balance": float(subledger_total),
            "difference": float(difference),
            "status": "MATCHED" if abs(difference) < Decimal("0.01") else "MISMATCH",
            "uninvoiced_grns": uninvoiced_grns
        }

    @staticmethod
    def get_finance_health(db: Session) -> Dict[str, Any]:
        """
        Aggregated KPI dashboard of General Ledger health.
        """
        excluded_ids = FinanceReportService._get_excluded_ids()
        
        # Trial Balance status
        tb = LedgerService.get_trial_balance(db)
        tb_diff = abs(tb['total_debit'] - tb['total_credit'])
        tb_status = "GREEN" if tb_diff < 0.01 else "RED"

        ap_recon = FinanceReportService.get_ap_reconciliation(db)
        ap_diff = abs(ap_recon["difference"])
        ap_status = "GREEN" if ap_diff < 0.01 else ("AMBER" if ap_diff < 1000 else "RED")

        grni_recon = FinanceReportService.get_grni_reconciliation(db)
        grni_diff = abs(grni_recon["difference"])
        grni_status = "GREEN" if grni_diff < 0.01 else ("AMBER" if grni_diff < 1000 else "RED")

        # Cash & Bank (1000)
        bank_acc = db.query(models.Account).filter(models.Account.code == "1000").first()
        cash_position = 0.0
        if bank_acc:
            debit_sum = db.query(func.sum(models.JournalLine.debit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == bank_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            credit_sum = db.query(func.sum(models.JournalLine.credit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == bank_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            )
            if excluded_ids["journal_entries"]:
                debit_sum = debit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
                credit_sum = credit_sum.filter(~models.JournalLine.journal_entry_id.in_(list(excluded_ids["journal_entries"])))
            cash_position = float((debit_sum.scalar() or Decimal("0.0")) - (credit_sum.scalar() or Decimal("0.0")))

        # Open Period
        active_periods = db.query(models.AccountingPeriod).filter(
            models.AccountingPeriod.status == "OPEN",
            models.AccountingPeriod.is_deleted == False
        ).order_by(models.AccountingPeriod.start_date.desc()).all()
        open_periods_list = [p.period_name for p in active_periods]

        # Last JV
        last_je_query = db.query(models.JournalEntry).filter(
            models.JournalEntry.is_deleted == False
        )
        if excluded_ids["journal_entries"]:
            last_je_query = last_je_query.filter(~models.JournalEntry.id.in_(list(excluded_ids["journal_entries"])))
        last_je = last_je_query.order_by(models.JournalEntry.created_at.desc()).first()
        
        last_jv_info = None
        if last_je:
            last_jv_info = {
                "entry_number": last_je.entry_number,
                "entry_date": last_je.entry_date.isoformat(),
                "reference_type": last_je.reference_type,
                "narration": last_je.narration
            }

        # Last successful auto posting
        last_auto_query = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type != "MANUAL",
            models.JournalEntry.is_deleted == False
        )
        if excluded_ids["journal_entries"]:
            last_auto_query = last_auto_query.filter(~models.JournalEntry.id.in_(list(excluded_ids["journal_entries"])))
        last_auto = last_auto_query.order_by(models.JournalEntry.created_at.desc()).first()
        
        last_auto_info = None
        if last_auto:
            last_auto_info = {
                "entry_number": last_auto.entry_number,
                "entry_date": last_auto.entry_date.isoformat(),
                "reference_type": last_auto.reference_type
            }

        # Unposted Transactions
        # GRNs without JE
        grns_query = db.query(models.GoodsReceiptNote).filter(
            models.GoodsReceiptNote.status.in_(["APPROVED", "COMPLETED"])
        )
        if excluded_ids["grns"]:
            grns_query = grns_query.filter(~models.GoodsReceiptNote.id.in_(list(excluded_ids["grns"])))
        all_grns = grns_query.all()
        unposted_grn_count = 0
        for g in all_grns:
            je_query = db.query(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "GRN",
                models.JournalEntry.reference_id == g.id
            )
            if excluded_ids["journal_entries"]:
                je_query = je_query.filter(~models.JournalEntry.id.in_(list(excluded_ids["journal_entries"])))
            je = je_query.first()
            if not je:
                unposted_grn_count += 1

        # Invoices without JE
        invoices_query = db.query(models.Invoice).filter(
            models.Invoice.status.in_([models.InvoiceStatus.APPROVED, models.InvoiceStatus.PENDING_MATCHING, models.InvoiceStatus.MATCHED])
        )
        if excluded_ids["invoices"]:
            invoices_query = invoices_query.filter(~models.Invoice.id.in_(list(excluded_ids["invoices"])))
        all_invoices = invoices_query.all()
        unposted_inv_count = 0
        for i in all_invoices:
            je_query = db.query(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "INVOICE",
                models.JournalEntry.reference_id == i.id
            )
            if excluded_ids["journal_entries"]:
                je_query = je_query.filter(~models.JournalEntry.id.in_(list(excluded_ids["journal_entries"])))
            je = je_query.first()
            if not je:
                unposted_inv_count += 1

        # Payments without JE
        payments_query = db.query(models.FinancialTransaction).filter(
            models.FinancialTransaction.transaction_type == "PAYMENT"
        )
        if excluded_ids["payments"]:
            payments_query = payments_query.filter(~models.FinancialTransaction.id.in_(list(excluded_ids["payments"])))
        all_payments = payments_query.all()
        unposted_pmt_count = 0
        for p in all_payments:
            je_query = db.query(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "PAYMENT",
                models.JournalEntry.reference_id == p.id
            )
            if excluded_ids["journal_entries"]:
                je_query = je_query.filter(~models.JournalEntry.id.in_(list(excluded_ids["journal_entries"])))
            je = je_query.first()
            if not je:
                unposted_pmt_count += 1

        total_unposted = unposted_grn_count + unposted_inv_count + unposted_pmt_count

        # Compute alerts
        alerts = []
        if tb_status == "RED":
            alerts.append({"type": "RED", "message": "Trial Balance is imbalanced!"})
        if ap_status == "RED":
            alerts.append({"type": "RED", "message": f"AP GL mismatch of ₹{ap_diff:,.2f} with subledger."})
        elif ap_status == "AMBER":
            alerts.append({"type": "AMBER", "message": f"Minor AP GL mismatch of ₹{ap_diff:,.2f} with subledger."})
            
        if grni_status == "RED":
            alerts.append({"type": "RED", "message": f"GRNI GL mismatch of ₹{grni_diff:,.2f} with uninvoiced GRNs."})
        elif grni_status == "AMBER":
            alerts.append({"type": "AMBER", "message": f"Minor GRNI GL mismatch of ₹{grni_diff:,.2f} with uninvoiced GRNs."})

        if total_unposted > 0:
            alerts.append({"type": "AMBER", "message": f"There are {total_unposted} unposted transactions waiting for GL entry."})

        # Calculate Inventory Health Metrics
        inventory_asset_value = db.query(func.sum(models.InventoryCostLayer.remaining_quantity * models.InventoryCostLayer.unit_cost)).filter(models.InventoryCostLayer.is_deleted == False).scalar() or Decimal("0.0")

        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        cogs_mtd = db.query(func.sum(models.InventoryIssueLine.total_cost)).join(models.InventoryIssue).filter(
            models.InventoryIssue.status == "POSTED",
            models.InventoryIssue.issue_date >= month_start,
            models.InventoryIssue.is_deleted == False
        ).scalar() or Decimal("0.0")

        thirty_days_ago = now - timedelta(days=30)
        cogs_30 = db.query(func.sum(models.InventoryIssueLine.total_cost)).join(models.InventoryIssue).filter(
            models.InventoryIssue.status == "POSTED",
            models.InventoryIssue.issue_date >= thirty_days_ago,
            models.InventoryIssue.is_deleted == False
        ).scalar() or Decimal("0.0")
        
        avg_inv_val = db.query(func.avg(models.InventorySnapshot.inventory_value)).filter(
            models.InventorySnapshot.snapshot_date >= thirty_days_ago,
            models.InventorySnapshot.is_deleted == False
        ).scalar()
        if not avg_inv_val:
            avg_inv_val = inventory_asset_value
            
        inventory_turnover = float(cogs_30 / avg_inv_val) if avg_inv_val > 0 else 0.0

        ninety_days_ago = now - timedelta(days=90)
        recently_issued_ids = [
            r[0] for r in db.query(models.InventoryValuationEntry.item_id).filter(
                models.InventoryValuationEntry.transaction_type == "CONSUMPTION",
                models.InventoryValuationEntry.created_at >= ninety_days_ago,
                models.InventoryValuationEntry.is_deleted == False
            ).distinct().all()
        ]
        
        dead_stock_exposure = db.query(
            func.sum(models.InventoryCostLayer.remaining_quantity * models.InventoryCostLayer.unit_cost)
        ).filter(
            ~models.InventoryCostLayer.item_id.in_(recently_issued_ids),
            models.InventoryCostLayer.is_deleted == False
        ).scalar() or Decimal("0.0")

        negative_inventory_count = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.quantity_on_hand < 0,
            models.WarehouseStock.is_deleted == False
        ).count()

        transit_acc = db.query(models.Account).filter(models.Account.code == "1250").first()
        transit_value = 0.0
        if transit_acc:
            transit_debit = db.query(func.sum(models.JournalLine.debit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == transit_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")
            transit_credit = db.query(func.sum(models.JournalLine.credit_amount)).join(models.JournalEntry).filter(
                models.JournalLine.account_id == transit_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")
            transit_value = float(transit_debit - transit_credit)

        return {
            "trial_balance": {
                "total_debit": tb["total_debit"],
                "total_credit": tb["total_credit"],
                "difference": float(tb_diff),
                "status": tb_status
            },
            "ap_reconciliation": {
                "gl_balance": ap_recon["gl_balance"],
                "subledger_balance": ap_recon["subledger_balance"],
                "difference": ap_recon["difference"],
                "status": ap_status
            },
            "grni_reconciliation": {
                "gl_balance": grni_recon["gl_balance"],
                "subledger_balance": grni_recon["subledger_balance"],
                "difference": grni_recon["difference"],
                "status": grni_status
            },
            "cash_position": cash_position,
            "open_periods": open_periods_list,
            "last_journal_voucher": last_jv_info,
            "unposted_transactions": {
                "grns": unposted_grn_count,
                "invoices": unposted_inv_count,
                "payments": unposted_pmt_count,
                "total": total_unposted
            },
            "alerts": alerts,
            "inventory_health": {
                "inventory_asset_value": float(inventory_asset_value),
                "cogs_mtd": float(cogs_mtd),
                "inventory_turnover": float(inventory_turnover),
                "dead_stock_exposure": float(dead_stock_exposure),
                "negative_inventory_count": negative_inventory_count,
                "inventory_in_transit_value": float(transit_value)
            },
            "audit_status": {
                "trial_balance_status": tb_status,
                "ap_status": ap_status,
                "grni_status": grni_status,
                "open_periods_count": len(open_periods_list),
                "last_successful_auto_posting": last_auto_info,
                "last_jv_number": last_jv_info["entry_number"] if last_jv_info else None
            }
        }
