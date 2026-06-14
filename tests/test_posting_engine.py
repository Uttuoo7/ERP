import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, VendorFactory, ItemFactory, WarehouseFactory,
    POFactory, GRNFactory, InvoiceFactory
)
from backend import models
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import event_dispatcher

pytestmark = pytest.mark.finance

# ─── Seeding Helpers ─────────────────────────────────────────────────────────

def seed_finance_data(db_session):
    """Seed accounts, fiscal years, periods, and posting configurations for testing."""
    # 1. Accounts
    accounts_data = [
        {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
        {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
        {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
        {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
        {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
        {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
    ]
    accounts_by_code = {}
    for data in accounts_data:
        acc = db_session.query(models.Account).filter_by(code=data["code"]).first()
        if not acc:
            acc = models.Account(
                code=data["code"],
                name=data["name"],
                account_type=data["account_type"],
                is_active=True
            )
            db_session.add(acc)
            db_session.flush()
        accounts_by_code[data["code"]] = acc

    # 2. Fiscal Years & Periods
    today = datetime.utcnow()
    
    # Active Fiscal Year
    fy_name = f"FY {today.year}"
    fy = db_session.query(models.FiscalYear).filter_by(name=fy_name).first()
    if not fy:
        fy = models.FiscalYear(
            name=fy_name,
            start_date=today - timedelta(days=180),
            end_date=today + timedelta(days=180),
            status="OPEN"
        )
        db_session.add(fy)
        db_session.flush()

    # Closed Fiscal Year (For Testing)
    past_year = today.year - 1
    past_fy_name = f"FY {past_year}"
    past_fy = db_session.query(models.FiscalYear).filter_by(name=past_fy_name).first()
    if not past_fy:
        past_fy = models.FiscalYear(
            name=past_fy_name,
            start_date=today - timedelta(days=500),
            end_date=today - timedelta(days=360),
            status="CLOSED"
        )
        db_session.add(past_fy)
        db_session.flush()

    # Current period
    period_name = today.strftime("%Y-%m")
    current_period = db_session.query(models.AccountingPeriod).filter_by(period_name=period_name).first()
    if not current_period:
        current_period = models.AccountingPeriod(
            period_name=period_name,
            start_date=today - timedelta(days=15),
            end_date=today + timedelta(days=15),
            status="OPEN",
            fiscal_year_id=fy.id
        )
        db_session.add(current_period)

    # Past period (Locked)
    past_date = today - timedelta(days=45)
    past_period_name = past_date.strftime("%Y-%m")
    past_period = db_session.query(models.AccountingPeriod).filter_by(period_name=past_period_name).first()
    if not past_period:
        past_period = models.AccountingPeriod(
            period_name=past_period_name,
            start_date=past_date - timedelta(days=15),
            end_date=past_date + timedelta(days=15),
            status="LOCKED",
            fiscal_year_id=fy.id
        )
        db_session.add(past_period)

    # 3. Posting Configs
    configs = [
        {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
        {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
        {"event_key": "GST_RECEIVABLE", "account_code": "1300"},
        {"event_key": "TDS_PAYABLE", "account_code": "2200"},
        {"event_key": "AP_CONTROL", "account_code": "2000"},
        {"event_key": "BANK_CONTROL", "account_code": "1000"},
    ]
    for cfg in configs:
        exists = db_session.query(models.PostingConfiguration).filter_by(event_key=cfg["event_key"]).first()
        if not exists:
            p_cfg = models.PostingConfiguration(
                event_key=cfg["event_key"],
                account_id=accounts_by_code[cfg["account_code"]].id
            )
            db_session.add(p_cfg)
            
    db_session.flush()

# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def seeded_db(db_session):
    seed_finance_data(db_session)
    # Force registration of listeners for integration testing
    PostingEngine.register_listeners(force=True)
    return db_session

@pytest.fixture
def finance_user(db_session):
    return UserFactory.create(db_session, role=models.Role.FINANCE)

@pytest.fixture
def admin_user(db_session):
    return UserFactory.create(db_session, role=models.Role.ADMIN)

@pytest.fixture
def vendor(db_session):
    return VendorFactory.create(db_session)

@pytest.fixture
def warehouse(db_session):
    return WarehouseFactory.create(db_session)

@pytest.fixture
def standard_po(db_session, vendor, warehouse, finance_user):
    po = POFactory.create(
        db_session, vendor=vendor, warehouse=warehouse, created_by=finance_user,
        total_amount=Decimal("10000.00"),
        status=models.POStatus.ISSUED,
    )
    line = models.POLineItem(
        id=uuid.uuid4(),
        po_id=po.id,
        item_id=ItemFactory.create(db_session, vendor_id=vendor.id).id,
        quantity_ordered=10,
        unit_price=Decimal("1000.00"),
        quantity_received=0,
    )
    db_session.add(line)
    db_session.flush()
    return po

# ─── Tests ───────────────────────────────────────────────────────────────────

class TestGLAutoPosting:

    def test_auto_posting_goods_received(self, seeded_db, standard_po, warehouse, finance_user):
        """Verify that accepting a GRN auto-posts a balanced GL Entry."""
        grn = GRNFactory.create(
            seeded_db, po=standard_po, warehouse=warehouse, received_by=finance_user,
            subtotal=Decimal("10000.00"), total_amount=Decimal("11800.00"), status="APPROVED"
        )
        
        # Dispatch event
        event_dispatcher.dispatch(
            "goods_received",
            {
                "grn_id": grn.id,
                "grn_number": grn.grn_number,
                "po_number": standard_po.po_number,
                "total_accepted": 10
            },
            seeded_db
        )
        
        # Check GL entry
        journal = seeded_db.query(models.JournalEntry).filter_by(
            reference_type="GRN", reference_id=grn.id
        ).first()
        
        assert journal is not None
        seeded_db.refresh(journal)
        assert journal.source_module == "PROCUREMENT"
        assert journal.source_event == "goods_received"
        assert journal.status == "POSTED"
        assert len(journal.journal_lines) == 2
        
        # Debits = Credits check
        debits = sum(line.debit_amount for line in journal.journal_lines)
        credits = sum(line.credit_amount for line in journal.journal_lines)
        assert debits == Decimal("10000.00")
        assert credits == Decimal("10000.00")
        
        # Check trial balance parity
        tb = LedgerService.get_trial_balance(seeded_db)
        assert tb["is_balanced"] is True
        assert tb["total_debit"] == 10000.00
        assert tb["total_credit"] == 10000.00

    def test_auto_posting_invoice_approved(self, seeded_db, standard_po, warehouse, finance_user, vendor):
        """Verify that approving an invoice auto-posts a balanced accruals journal."""
        grn = GRNFactory.create(
            seeded_db, po=standard_po, warehouse=warehouse, received_by=finance_user,
            subtotal=Decimal("10000.00"), total_amount=Decimal("11800.00")
        )
        invoice = InvoiceFactory.create(
            seeded_db, vendor=vendor, po=standard_po, grn=grn, created_by=finance_user,
            total_amount=Decimal("11800.00"), gst_amount=Decimal("1800.00"), status=models.InvoiceStatus.APPROVED
        )
        
        # Dispatch event
        event_dispatcher.dispatch(
            "invoice_approved",
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "liability_id": uuid.uuid4(),
                "total_amount": 11800.0
            },
            seeded_db
        )
        
        # Check GL entry
        journal = seeded_db.query(models.JournalEntry).filter_by(
            reference_type="INVOICE", reference_id=invoice.id
        ).first()
        
        assert journal is not None
        seeded_db.refresh(journal)
        assert journal.source_module == "PROCUREMENT"
        assert journal.source_event == "invoice_approved"
        
        # Debit: GRNI (10000), GST (1800)
        # Credit: AP Control (11800)
        debit_lines = [l for l in journal.journal_lines if l.debit_amount > 0]
        credit_lines = [l for l in journal.journal_lines if l.credit_amount > 0]
        
        assert len(debit_lines) == 2
        assert len(credit_lines) == 1
        assert sum(l.debit_amount for l in debit_lines) == Decimal("11800.00")
        assert sum(l.credit_amount for l in credit_lines) == Decimal("11800.00")
        
        tb = LedgerService.get_trial_balance(seeded_db)
        assert tb["is_balanced"] is True

    def test_auto_posting_payment_allocated(self, seeded_db, finance_user, vendor):
        """Verify payment allocations trigger cash disbursement GL postings."""
        tx = models.FinancialTransaction(
            transaction_number="FT-PY-9999",
            transaction_type="PAYMENT",
            transaction_date=datetime.utcnow(),
            reference_type="PAYMENT",
            reference_id=uuid.uuid4(),
            total_amount=Decimal("5000.00"),
            status="POSTED",
            vendor_id=vendor.id,
            created_by_id=finance_user.id
        )
        seeded_db.add(tx)
        seeded_db.flush()
        
        event_dispatcher.dispatch(
            "payment_allocated",
            {
                "payment_id": tx.id,
                "payment_ref": "REF-9999",
                "amount": 5000.0,
                "vendor_id": vendor.id
            },
            seeded_db
        )
        
        journal = seeded_db.query(models.JournalEntry).filter_by(
            reference_type="PAYMENT", reference_id=tx.id
        ).first()
        
        assert journal is not None
        seeded_db.refresh(journal)
        assert journal.source_module == "FINANCE"
        assert journal.source_event == "payment_allocated"
        
        debits = sum(line.debit_amount for line in journal.journal_lines)
        credits = sum(line.credit_amount for line in journal.journal_lines)
        assert debits == Decimal("5000.00")
        assert credits == Decimal("5000.00")
        
        tb = LedgerService.get_trial_balance(seeded_db)
        assert tb["is_balanced"] is True

    def test_locked_period_fails_auto_posting(self, seeded_db, standard_po, warehouse, finance_user):
        """Verify that trying to post into a closed or locked period fails."""
        # Create GRN in a locked period (45 days ago)
        past_date = datetime.utcnow() - timedelta(days=45)
        grn = GRNFactory.create(
            seeded_db, po=standard_po, warehouse=warehouse, received_by=finance_user,
            subtotal=Decimal("10000.00"), total_amount=Decimal("11800.00"), status="APPROVED",
            receipt_date=past_date
        )
        
        # Dispatch event (which logs the error and catches the ValueError)
        event_dispatcher.dispatch(
            "goods_received",
            {
                "grn_id": grn.id,
                "grn_number": grn.grn_number,
                "po_number": standard_po.po_number,
                "total_accepted": 10
            },
            seeded_db
        )
        
        # Assert no journal was posted
        journal = seeded_db.query(models.JournalEntry).filter_by(
            reference_type="GRN", reference_id=grn.id
        ).first()
        assert journal is None


class TestGLFoundationTests:

    def test_balanced_manual_journal_posting(self, seeded_db, finance_user):
        """Verify posting a balanced manual journal generates correct sequential numbering."""
        acc1 = seeded_db.query(models.Account).filter_by(code="1000").first()
        acc2 = seeded_db.query(models.Account).filter_by(code="2000").first()
        
        initial_tb = LedgerService.get_trial_balance(seeded_db)
        initial_debit = initial_tb["total_debit"]
        
        lines = [
            {"account_id": acc1.id, "debit_amount": 1500.00, "credit_amount": 0.0, "narration": "Debit bank"},
            {"account_id": acc2.id, "debit_amount": 0.0, "credit_amount": 1500.00, "narration": "Credit AP"},
        ]
        
        today = datetime.utcnow()
        entry = AccountingService.create_manual_journal_entry(
            db=seeded_db,
            entry_date=today,
            narration="Test manual balanced",
            lines=lines,
            user_id=finance_user.id
        )
        
        assert entry is not None
        assert entry.entry_number.startswith(f"JV-{today.year}-")
        assert entry.status == "POSTED"
        assert len(entry.journal_lines) == 2
        
        # Assert Trial Balance is certified balanced
        tb = LedgerService.get_trial_balance(seeded_db)
        assert tb["is_balanced"] is True
        assert tb["total_debit"] == initial_debit + 1500.00

    def test_unbalanced_manual_journal_rejection(self, seeded_db, finance_user):
        """Verify that unbalanced manual journals are rejected."""
        acc1 = seeded_db.query(models.Account).filter_by(code="1000").first()
        acc2 = seeded_db.query(models.Account).filter_by(code="2000").first()
        
        lines = [
            {"account_id": acc1.id, "debit_amount": 1500.00, "credit_amount": 0.0, "narration": "Debit bank"},
            {"account_id": acc2.id, "debit_amount": 0.0, "credit_amount": 1400.00, "narration": "Credit AP mismatch"},
        ]
        
        with pytest.raises(ValueError, match="out of balance"):
            AccountingService.create_manual_journal_entry(
                db=seeded_db,
                entry_date=datetime.utcnow(),
                narration="Test unbalanced rejection",
                lines=lines,
                user_id=finance_user.id
            )

    def test_closed_period_rejection(self, seeded_db, finance_user):
        """Verify that posting to closed fiscal years is rejected."""
        acc1 = seeded_db.query(models.Account).filter_by(code="1000").first()
        acc2 = seeded_db.query(models.Account).filter_by(code="2000").first()
        
        lines = [
            {"account_id": acc1.id, "debit_amount": 100.00, "credit_amount": 0.0, "narration": "Debit bank"},
            {"account_id": acc2.id, "debit_amount": 0.0, "credit_amount": 100.00, "narration": "Credit AP"},
        ]
        
        # Date falls in past closed fiscal year (e.g. 450 days ago)
        past_date = datetime.utcnow() - timedelta(days=450)
        
        # Create a period for this past date and link to closed FY
        past_fy = seeded_db.query(models.FiscalYear).filter(models.FiscalYear.status == "CLOSED").first()
        past_period = models.AccountingPeriod(
            period_name=past_date.strftime("%Y-%m"),
            start_date=past_date - timedelta(days=15),
            end_date=past_date + timedelta(days=15),
            status="OPEN",
            fiscal_year_id=past_fy.id
        )
        seeded_db.add(past_period)
        seeded_db.flush()
        
        with pytest.raises(ValueError, match="is CLOSED"):
            AccountingService.create_manual_journal_entry(
                db=seeded_db,
                entry_date=past_date,
                narration="Test closed fiscal year rejection",
                lines=lines,
                user_id=finance_user.id
            )

    def test_locked_period_rejection(self, seeded_db, finance_user):
        """Verify that posting to locked periods is rejected."""
        acc1 = seeded_db.query(models.Account).filter_by(code="1000").first()
        acc2 = seeded_db.query(models.Account).filter_by(code="2000").first()
        
        lines = [
            {"account_id": acc1.id, "debit_amount": 100.00, "credit_amount": 0.0, "narration": "Debit bank"},
            {"account_id": acc2.id, "debit_amount": 0.0, "credit_amount": 100.00, "narration": "Credit AP"},
        ]
        
        # Date falls in locked period (45 days ago)
        past_date = datetime.utcnow() - timedelta(days=45)
        
        with pytest.raises(ValueError, match="because its status is LOCKED"):
            AccountingService.create_manual_journal_entry(
                db=seeded_db,
                entry_date=past_date,
                narration="Test locked period rejection",
                lines=lines,
                user_id=finance_user.id
            )

    def test_journal_reversal(self, seeded_db, finance_user):
        """Verify reversing entries link back to the original voucher via reversal_of_journal_entry_id."""
        acc1 = seeded_db.query(models.Account).filter_by(code="1000").first()
        acc2 = seeded_db.query(models.Account).filter_by(code="2000").first()
        
        initial_tb = LedgerService.get_trial_balance(seeded_db)
        initial_debit = initial_tb["total_debit"]
        
        lines = [
            {"account_id": acc1.id, "debit_amount": 200.00, "credit_amount": 0.0, "narration": "Debit bank"},
            {"account_id": acc2.id, "debit_amount": 0.0, "credit_amount": 200.00, "narration": "Credit AP"},
        ]
        
        original = AccountingService.create_manual_journal_entry(
            db=seeded_db,
            entry_date=datetime.utcnow(),
            narration="Original entry for reversal",
            lines=lines,
            user_id=finance_user.id
        )
        
        reversal = AccountingService.reverse_journal_entry(
            db=seeded_db,
            entry_id=original.id,
            user_id=finance_user.id
        )
        
        assert reversal is not None
        assert reversal.status == "POSTED"
        assert reversal.reversal_of_journal_entry_id == original.id
        
        # Verify original entry status is updated to REVERSED
        seeded_db.refresh(original)
        assert original.status == "REVERSED"
        
        # Verify Trial Balance is certified balanced (reversal sums to 0 net ledger impact)
        tb = LedgerService.get_trial_balance(seeded_db)
        assert tb["is_balanced"] is True
        assert tb["total_debit"] == initial_debit + 400.00 # original 200 + reversal 200 debits
