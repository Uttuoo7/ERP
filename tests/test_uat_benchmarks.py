import time
import pytest
import numpy as np
from tests.factories.entity_factories import (
    POFactory, VendorFactory, ItemFactory, UserFactory, WarehouseFactory,
    GRNFactory, InvoiceFactory
)
from backend import models

pytestmark = pytest.mark.api

def test_uat_and_perf_benchmarks(client, db_session, admin_headers):
    print("\n\n=== PHASE 16 UAT PERFORMANCE BENCHMARKING ===")
    
    # 1. Setup/Seed database entities
    user = UserFactory.create(db_session)
    warehouse = WarehouseFactory.create(db_session)
    vendor = VendorFactory.create(db_session, name="Global Trading Solutions")
    item = ItemFactory.create(db_session, sku="SKU-UAT-990", name="High Grade Aluminum Valve")
    
    po_exact = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-1001", total_amount=12000)
    po_prefix = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-10010", total_amount=24000)
    po_prefix2 = POFactory.create(db_session, vendor=vendor, warehouse=warehouse, created_by=user, po_number="PO-10011", total_amount=36000)
    
    grn = GRNFactory.create(db_session, po=po_exact, warehouse=warehouse, received_by=user, grn_number="GRN-1001")
    invoice = InvoiceFactory.create(db_session, vendor=vendor, po=po_exact, grn=grn, created_by=user, invoice_number="INV-1001")
    
    # Add activities
    act1 = models.ActivityEvent(entity_type="PURCHASE_ORDER", entity_id=str(po_exact.id), action="CREATE", actor_id=str(user.id), description="Purchase Order PO-1001 created")
    act2 = models.ActivityEvent(entity_type="PURCHASE_ORDER", entity_id=str(po_exact.id), action="UPDATE", actor_id=str(user.id), description="Purchase Order PO-1001 approved")
    db_session.add(act1)
    db_session.add(act2)
    
    db_session.flush()

    # 2. Verify Search Ranking and Grouping Correctness
    response = client.get("/api/search?q=PO-1001", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Assert correct grouping keys
    for k in ["customers", "vendors", "items", "purchase_orders", "sales_orders", "work_orders", "grns", "invoices"]:
        assert k in data
        
    pos = data["purchase_orders"]
    assert len(pos) >= 3
    # Check ranking priority
    assert pos[0]["title"] == "PO-1001"
    assert pos[0]["priority"] == 1
    assert pos[0]["match_type"] == "exact_code"
    
    # 3. Latency Benchmarks
    iterations = 20
    
    # Search Benchmark
    search_times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        res = client.get("/api/search?q=PO-1001", headers=admin_headers)
        t1 = time.perf_counter()
        assert res.status_code == 200
        search_times.append((t1 - t0) * 1000) # ms
        
    # Notification Load Benchmark (Workflows Inbox)
    notif_times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        res = client.get("/api/workflow/inbox", headers=admin_headers)
        t1 = time.perf_counter()
        assert res.status_code == 200
        notif_times.append((t1 - t0) * 1000) # ms
        
    # Activity Timeline Load Benchmark
    activity_times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        res = client.get("/api/activity/activity/?limit=6", headers=admin_headers)
        t1 = time.perf_counter()
        assert res.status_code == 200
        activity_times.append((t1 - t0) * 1000) # ms

    # Compute Statistics
    avg_search = np.mean(search_times)
    p95_search = np.percentile(search_times, 95)
    
    avg_notif = np.mean(notif_times)
    p95_notif = np.percentile(notif_times, 95)
    
    avg_activity = np.mean(activity_times)
    p95_activity = np.percentile(activity_times, 95)
    
    # Dashboard load is modeled as concurrent/independent requests (slowest of activity or workflow load)
    # Target < 2.0s
    avg_dashboard = max(avg_notif, avg_activity)
    p95_dashboard = max(p95_notif, p95_activity)

    print("\n--- LATENCY SLA VERIFICATION RESULTS ---")
    print(f"Global Search Query (Target < 300 ms): Average = {avg_search:.2f} ms, p95 = {p95_search:.2f} ms")
    print(f"Notification Inbox Load (Target < 500 ms): Average = {avg_notif:.2f} ms, p95 = {p95_notif:.2f} ms")
    print(f"Activity Timeline Load (Target < 500 ms): Average = {avg_activity:.2f} ms, p95 = {p95_activity:.2f} ms")
    print(f"Independent Dashboard Load (Target < 2.0 s): Average = {avg_dashboard/1000:.4f} s, p95 = {p95_dashboard/1000:.4f} s")
    
    # Assert SLAs
    assert avg_search < 300.0, f"Search SLA exceeded: {avg_search:.2f} ms"
    assert avg_notif < 500.0, f"Notification SLA exceeded: {avg_notif:.2f} ms"
    assert avg_activity < 500.0, f"Activity Timeline SLA exceeded: {avg_activity:.2f} ms"
    assert (avg_dashboard / 1000.0) < 2.0, f"Dashboard load SLA exceeded: {avg_dashboard/1000.0:.4f} s"
    
    print("SLA Checks: ALL PASS")
    print("============================================\n")
