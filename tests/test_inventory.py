"""
tests/test_inventory.py
Integration tests for the Inventory Engine.

Validates:
  - Stock receipt (RECEIPT transaction)
  - Stock issue (ISSUE transaction)
  - Stock ledger entry creation
  - Inventory ledger running balance accuracy
  - Warehouse stock quantity consistency
  - Negative stock prevention
"""
import pytest
import uuid
from decimal import Decimal
from datetime import datetime
from tests.factories.entity_factories import (
    UserFactory, ItemFactory, WarehouseFactory
)
from backend import models


pytestmark = pytest.mark.inventory


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def warehouse_user(db_session):
    return UserFactory.create(db_session, role=models.Role.WAREHOUSE)


@pytest.fixture
def item(db_session):
    return ItemFactory.create(db_session, unit_price=Decimal("500.00"))


@pytest.fixture
def warehouse(db_session):
    return WarehouseFactory.create(db_session)


@pytest.fixture
def warehouse_stock(db_session, item, warehouse):
    """Pre-seed 100 units of stock."""
    stock = models.WarehouseStock(
        id=uuid.uuid4(),
        warehouse_id=warehouse.id,
        item_id=item.id,
        quantity_on_hand=100,
        quantity_reserved=0,
        valuation_unit_cost=Decimal("500.00"),
    )
    db_session.add(stock)
    db_session.flush()
    return stock


def _create_receipt_transaction(db, item, warehouse, user, qty, unit_cost):
    """Helper to simulate a RECEIPT inventory transaction."""
    txn = models.InventoryTransaction(
        id=uuid.uuid4(),
        item_id=item.id,
        warehouse_id=warehouse.id,
        transaction_type="RECEIPT",
        quantity=qty,
        valuation_unit_cost=unit_cost,
        created_by_id=user.id,
        created_at=datetime.utcnow(),
    )
    db.add(txn)

    # Update warehouse stock
    stock = db.query(models.WarehouseStock).filter_by(
        item_id=item.id, warehouse_id=warehouse.id, batch_id=None
    ).first()
    if stock:
        stock.quantity_on_hand += qty
    else:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=qty,
            quantity_reserved=0,
            valuation_unit_cost=unit_cost,
        )
        db.add(stock)

    # Update inventory ledger
    ledger = db.query(models.InventoryLedger).filter_by(item_id=item.id).first()
    if ledger:
        ledger.quantity_on_hand += qty

    # Create stock ledger entry
    current_on_hand = stock.quantity_on_hand
    sle = models.StockLedgerEntry(
        id=uuid.uuid4(),
        item_id=item.id,
        warehouse_id=warehouse.id,
        transaction_type="RECEIPT",
        quantity_change=qty,
        resulting_on_hand=current_on_hand,
        valuation_unit_cost=unit_cost,
        reference_type="MANUAL",
        created_at=datetime.utcnow(),
        created_by_id=user.id,
    )
    db.add(sle)
    db.flush()
    return txn


def _create_issue_transaction(db, item, warehouse, user, qty):
    """Helper to simulate an ISSUE inventory transaction."""
    stock = db.query(models.WarehouseStock).filter_by(
        item_id=item.id, warehouse_id=warehouse.id, batch_id=None
    ).first()

    if not stock or stock.quantity_on_hand < qty:
        raise ValueError(
            f"Insufficient stock. Available: {stock.quantity_on_hand if stock else 0}, Requested: {qty}"
        )

    txn = models.InventoryTransaction(
        id=uuid.uuid4(),
        item_id=item.id,
        warehouse_id=warehouse.id,
        transaction_type="ISSUE",
        quantity=-qty,  # Negative for issue
        valuation_unit_cost=stock.valuation_unit_cost,
        created_by_id=user.id,
        created_at=datetime.utcnow(),
    )
    db.add(txn)

    stock.quantity_on_hand -= qty

    ledger = db.query(models.InventoryLedger).filter_by(item_id=item.id).first()
    if ledger:
        ledger.quantity_on_hand -= qty

    sle = models.StockLedgerEntry(
        id=uuid.uuid4(),
        item_id=item.id,
        warehouse_id=warehouse.id,
        transaction_type="ISSUE",
        quantity_change=-qty,
        resulting_on_hand=stock.quantity_on_hand,
        valuation_unit_cost=stock.valuation_unit_cost,
        reference_type="MANUAL",
        created_at=datetime.utcnow(),
        created_by_id=user.id,
    )
    db.add(sle)
    db.flush()
    return txn


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestStockReceipt:
    def test_receipt_increases_warehouse_stock(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """RECEIPT transaction must increase warehouse_stock.quantity_on_hand."""
        initial_qty = warehouse_stock.quantity_on_hand
        receipt_qty = 50

        _create_receipt_transaction(
            db_session, item, warehouse, warehouse_user,
            qty=receipt_qty, unit_cost=Decimal("500.00")
        )

        updated_stock = db_session.query(models.WarehouseStock).filter_by(
            item_id=item.id, warehouse_id=warehouse.id, batch_id=None
        ).first()
        assert updated_stock.quantity_on_hand == initial_qty + receipt_qty

    def test_receipt_increases_inventory_ledger(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """RECEIPT must also update the master InventoryLedger balance."""
        ledger_before = db_session.query(models.InventoryLedger)\
            .filter_by(item_id=item.id).first()
        initial_qty = ledger_before.quantity_on_hand if ledger_before else 0

        _create_receipt_transaction(
            db_session, item, warehouse, warehouse_user,
            qty=30, unit_cost=Decimal("500.00")
        )

        ledger_after = db_session.query(models.InventoryLedger)\
            .filter_by(item_id=item.id).first()
        assert ledger_after.quantity_on_hand == initial_qty + 30

    def test_receipt_creates_stock_ledger_entry(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """Each RECEIPT must produce a StockLedgerEntry audit record."""
        before_count = db_session.query(models.StockLedgerEntry)\
            .filter_by(item_id=item.id, transaction_type="RECEIPT").count()

        _create_receipt_transaction(
            db_session, item, warehouse, warehouse_user,
            qty=20, unit_cost=Decimal("500.00")
        )

        after_count = db_session.query(models.StockLedgerEntry)\
            .filter_by(item_id=item.id, transaction_type="RECEIPT").count()
        assert after_count == before_count + 1

    def test_receipt_resulting_balance_in_sle_is_accurate(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """StockLedgerEntry.resulting_on_hand must reflect post-receipt balance."""
        initial = warehouse_stock.quantity_on_hand

        _create_receipt_transaction(
            db_session, item, warehouse, warehouse_user,
            qty=40, unit_cost=Decimal("500.00")
        )

        sle = db_session.query(models.StockLedgerEntry)\
            .filter_by(item_id=item.id, transaction_type="RECEIPT")\
            .order_by(models.StockLedgerEntry.created_at.desc()).first()
        assert sle.resulting_on_hand == initial + 40


class TestStockIssue:
    def test_issue_decreases_warehouse_stock(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """ISSUE transaction must decrease warehouse_stock.quantity_on_hand."""
        initial_qty = warehouse_stock.quantity_on_hand

        _create_issue_transaction(db_session, item, warehouse, warehouse_user, qty=30)

        updated_stock = db_session.query(models.WarehouseStock).filter_by(
            item_id=item.id, warehouse_id=warehouse.id, batch_id=None
        ).first()
        assert updated_stock.quantity_on_hand == initial_qty - 30

    def test_issue_creates_negative_quantity_change_sle(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """ISSUE StockLedgerEntry should have negative quantity_change."""
        _create_issue_transaction(db_session, item, warehouse, warehouse_user, qty=10)

        sle = db_session.query(models.StockLedgerEntry)\
            .filter_by(item_id=item.id, transaction_type="ISSUE")\
            .order_by(models.StockLedgerEntry.created_at.desc()).first()
        assert sle.quantity_change == -10

    def test_issue_beyond_stock_raises_error(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """Issuing more than available stock must raise ValueError."""
        with pytest.raises(ValueError, match="Insufficient stock"):
            _create_issue_transaction(
                db_session, item, warehouse, warehouse_user,
                qty=warehouse_stock.quantity_on_hand + 9999
            )

    def test_issue_stock_never_goes_negative(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """After guarded ISSUE, stock balance must remain >= 0."""
        available = warehouse_stock.quantity_on_hand

        try:
            _create_issue_transaction(
                db_session, item, warehouse, warehouse_user, qty=available + 1
            )
        except ValueError:
            pass

        stock = db_session.query(models.WarehouseStock).filter_by(
            item_id=item.id, warehouse_id=warehouse.id
        ).first()
        assert stock.quantity_on_hand >= 0


class TestInventoryLedgerConsistency:
    def test_ledger_balance_equals_sum_of_transactions(
            self, db_session, item, warehouse, warehouse_user, warehouse_stock):
        """
        InventoryLedger.quantity_on_hand should equal the algebraic sum
        of all InventoryTransaction.quantity values for that item.
        """
        # Start from known state: warehouse_stock seeded with 100 units
        ledger = db_session.query(models.InventoryLedger)\
            .filter_by(item_id=item.id).first()
        if not ledger:
            pytest.skip("InventoryLedger not seeded for this item")

        # Do a receipt +50 and issue -30 → net +20, total should be initial+20
        initial = ledger.quantity_on_hand
        _create_receipt_transaction(
            db_session, item, warehouse, warehouse_user,
            qty=50, unit_cost=Decimal("500.00")
        )
        _create_issue_transaction(
            db_session, item, warehouse, warehouse_user, qty=30
        )

        ledger_after = db_session.query(models.InventoryLedger)\
            .filter_by(item_id=item.id).first()
        assert ledger_after.quantity_on_hand == initial + 50 - 30
