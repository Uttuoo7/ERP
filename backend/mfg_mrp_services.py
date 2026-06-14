from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import uuid
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

def create_mrp_document_relationship(db: Session, rec: models.MRPRecommendation, pr: models.PurchaseRequisition, pr_line: models.PurchaseRequisitionLine, user_id: uuid.UUID):
    existing_rel = db.query(models.DocumentRelationship).filter(
        models.DocumentRelationship.source_type == 'MRP_RECOMMENDATION',
        models.DocumentRelationship.source_id == rec.id,
        models.DocumentRelationship.target_type == 'PURCHASE_REQUISITION',
        models.DocumentRelationship.target_id == pr.id
    ).first()
    
    if not existing_rel:
        rel = models.DocumentRelationship(
            source_type='MRP_RECOMMENDATION',
            source_id=rec.id,
            target_type='PURCHASE_REQUISITION',
            target_id=pr.id,
            relationship_type='CONVERSION',
            created_by_id=user_id,
            created_at=datetime.utcnow()
        )
        db.add(rel)
        db.flush()
        
        line_rel = models.DocumentLineRelationship(
            document_relationship_id=rel.id,
            source_line_id=rec.id,
            target_line_id=pr_line.id,
            quantity_converted=pr_line.quantity,
            conversion_status='COMPLETED',
            created_by_id=user_id,
            created_at=datetime.utcnow()
        )
        db.add(line_rel)

def run_mrp_engine(
    db: Session,
    warehouse_id: Optional[uuid.UUID] = None,
    planning_horizon_days: int = 30,
    generated_by_id: Optional[uuid.UUID] = None
) -> List[models.MRPRecommendation]:
    # 1. Clear old pending recommendations
    db.query(models.MRPRecommendation).filter(models.MRPRecommendation.status == 'PENDING').delete()
    
    # Get active tenant id or default
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
    
    # 2. Get user id
    if not generated_by_id:
        user = db.query(models.User).first()
        if user:
            generated_by_id = user.id
        else:
            generated_by_id = uuid.uuid4()
            
    # 3. Create MRP Plan
    count = db.query(func.count(models.MRPPlan.id)).scalar() or 0
    plan_number = f"MRP-PLAN-{(count + 1):04d}"
    
    mrp_plan = models.MRPPlan(
        plan_number=plan_number,
        warehouse_id=warehouse_id,
        planning_horizon_days=planning_horizon_days,
        status='DRAFT',
        items_analyzed=0,
        recommendations_generated=0,
        total_recommended_value=Decimal('0.00'),
        run_duration_ms=0,
        generated_at=datetime.utcnow(),
        generated_by_id=generated_by_id,
        tenant_id=tenant_id
    )
    db.add(mrp_plan)
    db.flush() # Get plan ID
    
    start_time = datetime.utcnow()
    
    # 4. Get items and warehouses to analyze
    items = db.query(models.Item).filter(models.Item.is_active == True, models.Item.is_deleted == False).all()
    
    if warehouse_id:
        warehouses = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id, models.Warehouse.is_deleted == False).all()
    else:
        warehouses = db.query(models.Warehouse).filter(models.Warehouse.is_deleted == False).all()
        
    # Get all planned work orders for dependent demand
    planned_wos = db.query(models.WorkOrder).filter(
        models.WorkOrder.status == 'PLANNED',
        models.WorkOrder.is_deleted == False
    ).all()
    
    now = datetime.utcnow()
    horizon_date = now + timedelta(days=planning_horizon_days)
    
    items_analyzed_count = 0
    recs_generated_count = 0
    total_val = Decimal('0.00')
    recommendations = []
    recommendations_set = set()
    
    # --- Bulk Data Prefetching Optimization ---
    # 1. Stocks Map
    stocks = db.query(models.InventoryStock).filter(models.InventoryStock.is_deleted == False).all()
    stocks_map = {}
    for s in stocks:
        stocks_map[(s.item_id, s.warehouse_id)] = (float(s.current_stock or 0.0), float(s.reserved_stock or 0.0))
        
    # 2. Warehouse stocks Map
    wh_stocks = db.query(models.WarehouseStock).filter(models.WarehouseStock.is_deleted == False).all()
    wh_stocks_map = {}
    for ws in wh_stocks:
        wh_stocks_map[(ws.item_id, ws.warehouse_id)] = float(ws.quantity_transit or 0.0)
        
    # 3. Open PO Line Map
    po_sums = db.query(
        models.POLineItem.item_id,
        models.PurchaseOrder.warehouse_id,
        func.sum(models.POLineItem.quantity_ordered - models.POLineItem.quantity_received)
    ).join(models.PurchaseOrder).filter(
        models.PurchaseOrder.status.in_(['ISSUED', 'PARTIAL_RECEIPT']),
        models.POLineItem.is_deleted == False,
        models.PurchaseOrder.is_deleted == False
    ).group_by(models.POLineItem.item_id, models.PurchaseOrder.warehouse_id).all()
    
    open_po_map = {}
    for item_id, wh_id, qty in po_sums:
        open_po_map[(item_id, wh_id)] = float(qty or 0.0)
        
    # 4. Forecasts Map
    forecast_sums = db.query(
        models.DemandForecast.item_id,
        models.DemandForecast.warehouse_id,
        func.sum(models.DemandForecast.forecast_qty)
    ).filter(
        models.DemandForecast.forecast_date >= now,
        models.DemandForecast.forecast_date <= horizon_date,
        models.DemandForecast.is_active == True,
        models.DemandForecast.is_deleted == False
    ).group_by(models.DemandForecast.item_id, models.DemandForecast.warehouse_id).all()
    
    forecast_map = {}
    for item_id, wh_id, qty in forecast_sums:
        forecast_map[(item_id, wh_id)] = float(qty or 0.0)
        
    # 5. Component Demand Map (BOM dependent demand)
    comp_demand_map = {}
    for wo in planned_wos:
        bom = db.query(models.BillOfMaterial).filter(
            models.BillOfMaterial.item_id == wo.item_id,
            models.BillOfMaterial.status == 'ACTIVE',
            models.BillOfMaterial.is_deleted == False
        ).first()
        if not bom:
            continue
        for li in bom.line_items:
            qty_needed = float(li.quantity) * float(wo.quantity) * (1 + float(li.scrap_factor))
            comp_demand_map[li.component_item_id] = comp_demand_map.get(li.component_item_id, 0.0) + qty_needed
            
    # 6. Safety Stock Policies Map
    policies = db.query(models.SafetyStockPolicy).filter(models.SafetyStockPolicy.is_deleted == False).all()
    policies_map = {}
    for p in policies:
        policies_map[(p.item_id, p.warehouse_id)] = p
        
    # 7. PO Lines for Expedite Map
    all_po_lines = db.query(models.POLineItem).join(models.PurchaseOrder).\
        filter(
            models.PurchaseOrder.status.in_(['ISSUED', 'PARTIAL_RECEIPT']),
            models.POLineItem.is_deleted == False,
            models.PurchaseOrder.is_deleted == False
        ).all()
        
    po_lines_by_item_wh = {}
    for line in all_po_lines:
        key = (line.item_id, line.purchase_order.warehouse_id)
        if key not in po_lines_by_item_wh:
            po_lines_by_item_wh[key] = []
        po_lines_by_item_wh[key].append(line)
        
    items_by_id = {item.id: item for item in items}
    # ------------------------------------------

    def get_wh_item_stats(item_id, wh_id):
        on_hand, reserved = stocks_map.get((item_id, wh_id), (0.0, 0.0))
        transit = wh_stocks_map.get((item_id, wh_id), 0.0)
        open_po = open_po_map.get((item_id, wh_id), 0.0)
        forecast = forecast_map.get((item_id, wh_id), 0.0)
        comp_demand = comp_demand_map.get(item_id, 0.0)
        
        total_d = forecast + comp_demand
        net_avail = on_hand - reserved + open_po + transit - total_d
        
        policy_rec = policies_map.get((item_id, wh_id))
        
        if policy_rec:
            safety_stock = float(policy_rec.safety_stock_qty)
            reorder_point = float(policy_rec.reorder_point_qty)
            reorder_q = float(policy_rec.reorder_qty)
            lt = policy_rec.lead_time_days
        else:
            safety_stock = 0.0
            item_obj = items_by_id[item_id]
            reorder_point = float(item_obj.reorder_level) if item_obj.reorder_level else 0.0
            reorder_q = float(item_obj.minimum_stock) if item_obj.minimum_stock else 0.0
            lt = 0
            
        return {
            'on_hand': on_hand,
            'reserved': reserved,
            'open_po': open_po,
            'transit': transit,
            'forecast': total_d,
            'net_avail': net_avail,
            'safety_stock': safety_stock,
            'reorder_point': reorder_point,
            'reorder_qty': reorder_q,
            'lead_time': lt
        }
    
    for item in items:
        max_reorder_limit = float(item.maximum_stock) if (item.maximum_stock and float(item.maximum_stock) > 0) else None
        
        for wh in warehouses:
            stats = get_wh_item_stats(item.id, wh.id)
            
            # Skip if everything is zero to avoid cluttering the plan
            if stats['on_hand'] == 0 and stats['reserved'] == 0 and stats['open_po'] == 0 and stats['transit'] == 0 and stats['forecast'] == 0 and stats['safety_stock'] == 0:
                continue
                
            items_analyzed_count += 1
            
            # Snapshot creation
            snapshot = models.MRPSnapshot(
                source_plan_id=mrp_plan.id,
                item_id=item.id,
                warehouse_id=wh.id,
                on_hand_qty=Decimal(str(stats['on_hand'])),
                in_transit_qty=Decimal(str(stats['transit'])),
                open_po_qty=Decimal(str(stats['open_po'])),
                reserved_qty=Decimal(str(stats['reserved'])),
                forecast_qty=Decimal(str(stats['forecast'])),
                net_available_qty=Decimal(str(stats['net_avail'])),
                tenant_id=tenant_id
            )
            db.add(snapshot)
            
            # Recommendation trigger condition: falling below safety stock or reorder point
            trigger_level = max(stats['safety_stock'], stats['reorder_point'])
            
            if stats['net_avail'] < trigger_level or stats['net_avail'] < 0:
                # Prevent duplicate recommendations for the same Item + Warehouse + Plan
                dup_exists = (item.id, wh.id) in recommendations_set
                
                if dup_exists:
                    continue
                
                shortage_qty = trigger_level - stats['net_avail']
                if shortage_qty <= 0 and stats['net_avail'] < 0:
                    shortage_qty = abs(stats['net_avail'])
                
                shortage_qty = max(0.0, shortage_qty)
                if shortage_qty == 0:
                    continue
                
                avail_qty = stats['on_hand'] - stats['reserved'] + stats['open_po'] + stats['transit']
                if avail_qty <= 0:
                    priority = 'CRITICAL'
                elif avail_qty < stats['safety_stock']:
                    priority = 'HIGH'
                elif avail_qty < stats['reorder_point']:
                    priority = 'MEDIUM'
                else:
                    priority = 'LOW'
                
                required_date = now + timedelta(days=stats['lead_time'])
                
                # A. Try EXPEDITE first:
                po_lines = po_lines_by_item_wh.get((item.id, wh.id), [])
                
                expedite_po_line = None
                for line in po_lines:
                    po_expected_date = line.delivery_date or line.purchase_order.expected_delivery_date
                    if po_expected_date and po_expected_date > required_date:
                        remaining_qty = float(line.quantity_ordered - line.quantity_received)
                        if remaining_qty >= shortage_qty:
                            expedite_po_line = line
                            break
                            
                if expedite_po_line:
                    rec_qty = shortage_qty
                    if max_reorder_limit:
                        rec_qty = min(rec_qty, max_reorder_limit)
                    rec_qty = max(0.0, rec_qty)
                    if rec_qty <= 0:
                        continue
                    
                    unit_cost = float(item.standard_rate) if item.standard_rate else (float(item.unit_price) if item.unit_price else 0.0)
                    total_cost = rec_qty * unit_cost
                    
                    rec = models.MRPRecommendation(
                        item_id=item.id,
                        warehouse_id=wh.id,
                        required_qty=stats['forecast'],
                        available_qty=stats['on_hand'] - stats['reserved'] + stats['open_po'] + stats['transit'],
                        shortage_qty=shortage_qty,
                        recommended_procurement_qty=rec_qty,
                        recommended_order_qty=Decimal(str(rec_qty)),
                        recommendation_type='EXPEDITE',
                        required_date=required_date,
                        priority=priority,
                        source_plan_id=mrp_plan.id,
                        estimated_unit_cost=Decimal(str(unit_cost)),
                        estimated_total_cost=Decimal(str(total_cost)),
                        status='PENDING',
                        tenant_id=tenant_id,
                        reason_code='SUPPLY_DELAY',
                        narrative=f"Projected inventory falls below target on {required_date.date()}. Shortage of {shortage_qty:.2f} units can be covered by expediting PO {expedite_po_line.purchase_order.po_number} expected on {po_expected_date.date()}.",
                        source_po_id=expedite_po_line.po_id
                    )
                    db.add(rec)
                    recommendations.append(rec)
                    recommendations_set.add((item.id, wh.id))
                    recs_generated_count += 1
                    total_val += Decimal(str(total_cost))
                    continue
                
                # B. Try TRANSFER second:
                transfer_source = None
                transfer_qty = 0.0
                
                for other_wh in warehouses:
                    if other_wh.id == wh.id:
                        continue
                    other_stats = get_wh_item_stats(item.id, other_wh.id)
                    other_trigger = max(other_stats['safety_stock'], other_stats['reorder_point'])
                    surplus = other_stats['net_avail'] - other_trigger
                    
                    if surplus > 0:
                        candidate_qty = min(shortage_qty, surplus)
                        if (other_stats['net_avail'] - candidate_qty >= other_stats['safety_stock'] and 
                            other_stats['net_avail'] - candidate_qty >= other_stats['reorder_point']):
                            transfer_source = other_wh
                            transfer_qty = candidate_qty
                            break
                            
                if transfer_source and transfer_qty > 0:
                    rec_qty = transfer_qty
                    if max_reorder_limit:
                        rec_qty = min(rec_qty, max_reorder_limit)
                    rec_qty = max(0.0, rec_qty)
                    if rec_qty <= 0:
                        continue
                    
                    unit_cost = float(item.standard_rate) if item.standard_rate else (float(item.unit_price) if item.unit_price else 0.0)
                    total_cost = rec_qty * unit_cost
                    
                    rec = models.MRPRecommendation(
                        item_id=item.id,
                        warehouse_id=wh.id,
                        required_qty=stats['forecast'],
                        available_qty=stats['on_hand'] - stats['reserved'] + stats['open_po'] + stats['transit'],
                        shortage_qty=shortage_qty,
                        recommended_procurement_qty=rec_qty,
                        recommended_order_qty=Decimal(str(rec_qty)),
                        recommendation_type='TRANSFER',
                        required_date=required_date,
                        priority=priority,
                        source_plan_id=mrp_plan.id,
                        estimated_unit_cost=Decimal(str(unit_cost)),
                        estimated_total_cost=Decimal(str(total_cost)),
                        status='PENDING',
                        tenant_id=tenant_id,
                        reason_code='TRANSFER_OPPORTUNITY',
                        narrative=f"Projected inventory falls below target on {required_date.date()}. Shortage of {shortage_qty:.2f} units met by transferring {rec_qty:.2f} units from {transfer_source.name}."
                    )
                    db.add(rec)
                    recommendations.append(rec)
                    recommendations_set.add((item.id, wh.id))
                    recs_generated_count += 1
                    total_val += Decimal(str(total_cost))
                    continue
                
                # C. Fallback to PURCHASE:
                rec_qty = max(shortage_qty, stats['reorder_qty'])
                if max_reorder_limit:
                    rec_qty = min(rec_qty, max_reorder_limit)
                rec_qty = max(0.0, rec_qty)
                if rec_qty <= 0:
                    continue
                
                unit_cost = float(item.standard_rate) if item.standard_rate else (float(item.unit_price) if item.unit_price else 0.0)
                total_cost = rec_qty * unit_cost
                
                reason_code = 'SAFETY_STOCK_BREACH' if stats['net_avail'] < stats['safety_stock'] else 'REORDER_POINT_BREACH'
                if stats['forecast'] > 0 and stats['net_avail'] < stats['safety_stock']:
                    reason_code = 'FORECAST_SHORTAGE'
                
                rec = models.MRPRecommendation(
                    item_id=item.id,
                    warehouse_id=wh.id,
                    required_qty=stats['forecast'],
                    available_qty=stats['on_hand'] - stats['reserved'] + stats['open_po'] + stats['transit'],
                    shortage_qty=shortage_qty,
                    recommended_procurement_qty=rec_qty,
                    recommended_order_qty=Decimal(str(rec_qty)),
                    recommendation_type='PURCHASE',
                    required_date=required_date,
                    priority=priority,
                    source_plan_id=mrp_plan.id,
                    estimated_unit_cost=Decimal(str(unit_cost)),
                    estimated_total_cost=Decimal(str(total_cost)),
                    status='PENDING',
                    tenant_id=tenant_id,
                    reason_code=reason_code,
                    narrative=f"Projected inventory falls below target on {required_date.date()}. Shortage quantity {shortage_qty:.2f} units. No available transfer source found. Purchase recommendation generated."
                )
                db.add(rec)
                recommendations.append(rec)
                recommendations_set.add((item.id, wh.id))
                recs_generated_count += 1
                total_val += Decimal(str(total_cost))
                
    end_time = datetime.utcnow()
    duration_ms = int((end_time - start_time).total_seconds() * 1000)
    
    mrp_plan.items_analyzed = items_analyzed_count
    mrp_plan.recommendations_generated = recs_generated_count
    mrp_plan.total_recommended_value = total_val
    mrp_plan.run_duration_ms = duration_ms
    mrp_plan.status = 'COMPLETED'
    
    db.commit()
    return recommendations

def get_mrp_recommendations(db: Session, skip: int = 0, limit: int = 100) -> List[models.MRPRecommendation]:
    return db.query(models.MRPRecommendation).order_by(models.MRPRecommendation.created_at.desc()).offset(skip).limit(limit).all()

def get_mrp_plans(db: Session, skip: int = 0, limit: int = 100) -> List[models.MRPPlan]:
    return db.query(models.MRPPlan).order_by(models.MRPPlan.generated_at.desc()).offset(skip).limit(limit).all()

def get_mrp_plan(db: Session, plan_id: uuid.UUID) -> Optional[models.MRPPlan]:
    return db.query(models.MRPPlan).filter(models.MRPPlan.id == plan_id).first()

def convert_single_recommendation(db: Session, rec: models.MRPRecommendation, user_id: uuid.UUID) -> None:
    tenant_id = rec.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000")
    
    if rec.recommendation_type == 'EXPEDITE':
        if rec.source_po_id:
            pol = db.query(models.POLineItem).filter(
                models.POLineItem.po_id == rec.source_po_id,
                models.POLineItem.item_id == rec.item_id
            ).first()
            if pol:
                pol.delivery_date = rec.required_date
                
                rel = models.DocumentRelationship(
                    source_type="MRP_RECOMMENDATION",
                    source_id=rec.id,
                    target_type="PURCHASE_ORDER",
                    target_id=rec.source_po_id,
                    relationship_type="EXPEDITE",
                    created_by_id=user_id,
                    tenant_id=tenant_id
                )
                db.add(rel)
                db.flush()
                
                line_rel = models.DocumentLineRelationship(
                    document_relationship_id=rel.id,
                    source_line_id=rec.id,
                    target_line_id=pol.id,
                    quantity_converted=Decimal(str(rec.recommended_procurement_qty)),
                    conversion_status="COMPLETED",
                    created_by_id=user_id
                )
                db.add(line_rel)
                rec.status = 'CONVERTED'
                return
                
    if rec.recommendation_type == 'TRANSFER':
        # Find a surplus warehouse
        source_wh_id = None
        warehouses = db.query(models.Warehouse).all()
        for w in warehouses:
            if w.id == rec.warehouse_id:
                continue
            stock = db.query(models.WarehouseStock).filter_by(warehouse_id=w.id, item_id=rec.item_id, batch_id=None).first()
            if stock and stock.quantity_on_hand > 0:
                source_wh_id = w.id
                break
                
        if source_wh_id:
            trf_count = db.query(func.count(models.InventoryTransfer.id)).scalar() or 0
            transfer_number = f"TRF-MRP-{(trf_count + 1):04d}"
            
            transfer = models.InventoryTransfer(
                transfer_number=transfer_number,
                source_warehouse_id=source_wh_id,
                destination_warehouse_id=rec.warehouse_id,
                status="DRAFT",
                remarks=f"MRP Auto Stock Transfer - Plan {rec.source_plan.plan_number if rec.source_plan else 'N/A'}",
                created_by_id=user_id,
                tenant_id=tenant_id
            )
            db.add(transfer)
            db.flush()
            
            line = models.InventoryTransferLine(
                transfer_id=transfer.id,
                item_id=rec.item_id,
                qty_requested=int(rec.recommended_procurement_qty),
                qty_transferred=0,
                qty_received=0,
                unit_cost=rec.estimated_unit_cost or Decimal('0.00'),
                tenant_id=tenant_id
            )
            db.add(line)
            db.flush()
            
            rel = models.DocumentRelationship(
                source_type="MRP_RECOMMENDATION",
                source_id=rec.id,
                target_type="INVENTORY_TRANSFER",
                target_id=transfer.id,
                relationship_type="CONVERSION",
                created_by_id=user_id,
                tenant_id=tenant_id
            )
            db.add(rel)
            db.flush()
            
            line_rel = models.DocumentLineRelationship(
                document_relationship_id=rel.id,
                source_line_id=rec.id,
                target_line_id=line.id,
                quantity_converted=Decimal(str(rec.recommended_procurement_qty)),
                conversion_status="COMPLETED",
                created_by_id=user_id
            )
            db.add(line_rel)
            rec.status = 'CONVERTED'
            return

    # Fallback to PURCHASE / regular Purchase Requisition creation
    pr_count = db.query(func.count(models.PurchaseRequisition.id)).scalar() or 0
    pr_number = f"PR-MRP-{(pr_count + 1):04d}"
    
    pr = models.PurchaseRequisition(
        pr_number=pr_number,
        status='APPROVED',
        requester_id=user_id,
        required_date=rec.required_date,
        remarks=f"MRP Auto Requisition - Plan {rec.source_plan.plan_number if rec.source_plan else 'N/A'}",
        tenant_id=tenant_id
    )
    db.add(pr)
    db.flush()
    
    item_obj = db.query(models.Item).filter(models.Item.id == rec.item_id).first()
    uom = item_obj.uom if (item_obj and item_obj.uom) else "Nos"
    
    pr_line = models.PurchaseRequisitionLine(
        pr_id=pr.id,
        item_id=rec.item_id,
        quantity=rec.recommended_order_qty or Decimal(str(rec.recommended_procurement_qty)),
        uom=uom,
        estimated_price=rec.estimated_unit_cost or Decimal('0.00'),
        required_date=rec.required_date,
        tenant_id=tenant_id
    )
    db.add(pr_line)
    db.flush()
    
    rec.purchase_requisition_id = pr.id
    rec.purchase_requisition_line_id = pr_line.id
    rec.status = 'CONVERTED'
    
    create_mrp_document_relationship(db, rec, pr, pr_line, user_id)

def approve_recommendation(db: Session, rec_id: uuid.UUID) -> Optional[models.MRPRecommendation]:
    rec = db.query(models.MRPRecommendation).filter(models.MRPRecommendation.id == rec_id).first()
    if not rec:
        return None
    
    # Prevent double conversion / re-approval, but handle deleted target PR
    if rec.status == 'CONVERTED' or rec.purchase_requisition_id is not None:
        pr_exists = True
        if rec.purchase_requisition_id:
            pr_exists = db.query(models.PurchaseRequisition).filter_by(id=rec.purchase_requisition_id).first() is not None
        
        if not pr_exists:
            # Target PR was deleted! Reset reference and allow re-conversion
            rec.purchase_requisition_id = None
            rec.purchase_requisition_line_id = None
            rec.status = 'PENDING'
        else:
            return rec
        
    rec.status = 'APPROVED'
    
    user = db.query(models.User).first()
    user_id = user.id if user else uuid.uuid4()
    
    convert_single_recommendation(db, rec, user_id)
    
    db.commit()
    return rec

def reject_recommendation(db: Session, rec_id: uuid.UUID) -> Optional[models.MRPRecommendation]:
    rec = db.query(models.MRPRecommendation).filter(models.MRPRecommendation.id == rec_id).first()
    if not rec:
        return None
    # Prevent changing status if already converted
    if rec.status == 'CONVERTED':
        return rec
    rec.status = 'REJECTED'
    db.commit()
    return rec

def confirm_mrp_plan(db: Session, plan_id: uuid.UUID) -> Optional[models.MRPPlan]:
    plan = db.query(models.MRPPlan).filter(models.MRPPlan.id == plan_id).first()
    if not plan:
        return None
    plan.status = 'COMPLETED'
    
    user = db.query(models.User).first()
    user_id = user.id if user else uuid.uuid4()
    
    # Approve all PENDING recommendations within this plan
    for rec in plan.recommendations:
        if rec.status == 'PENDING':
            rec.status = 'APPROVED'
            convert_single_recommendation(db, rec, user_id)
            
    db.commit()
    return plan

def get_demand_forecasts(db: Session, skip: int = 0, limit: int = 100) -> List[models.DemandForecast]:
    return db.query(models.DemandForecast).filter(models.DemandForecast.is_deleted == False).offset(skip).limit(limit).all()

def create_demand_forecast(db: Session, forecast_in: schemas.DemandForecastCreate, tenant_id: uuid.UUID) -> models.DemandForecast:
    forecast = models.DemandForecast(
        item_id=forecast_in.item_id,
        warehouse_id=forecast_in.warehouse_id,
        forecast_date=forecast_in.forecast_date,
        forecast_qty=forecast_in.forecast_qty,
        forecast_method=forecast_in.forecast_method,
        forecast_version=forecast_in.forecast_version,
        is_active=forecast_in.is_active,
        tenant_id=tenant_id
    )
    db.add(forecast)
    db.commit()
    db.refresh(forecast)
    return forecast

def generate_moving_average_forecast(db: Session, request: schemas.DemandForecastGenerateRequest, tenant_id: uuid.UUID) -> models.DemandForecast:
    # Look back request.months_lookback months
    now = datetime.utcnow()
    lookback_start = now - timedelta(days=request.months_lookback * 30)
    
    # Query total issues for item and warehouse in lookback period
    issues_sum = db.query(func.sum(models.InventoryIssueLine.quantity)).\
        join(models.InventoryIssue).\
        filter(
            models.InventoryIssueLine.item_id == request.item_id,
            models.InventoryIssue.warehouse_id == request.warehouse_id,
            models.InventoryIssue.issue_date >= lookback_start,
            models.InventoryIssue.issue_date <= now,
            models.InventoryIssue.status == 'APPROVED',
            models.InventoryIssueLine.is_deleted == False,
            models.InventoryIssue.is_deleted == False
        ).scalar()
        
    total_qty = float(issues_sum) if issues_sum else 0.0
    monthly_avg = total_qty / max(request.months_lookback, 1)
    
    # Create forecast
    forecast = models.DemandForecast(
        item_id=request.item_id,
        warehouse_id=request.warehouse_id,
        forecast_date=request.forecast_date,
        forecast_qty=Decimal(str(monthly_avg)),
        forecast_method=request.method,
        forecast_version="AUTO_MA",
        is_active=True,
        tenant_id=tenant_id
    )
    db.add(forecast)
    db.commit()
    db.refresh(forecast)
    return forecast

def get_safety_stock_policies(db: Session, skip: int = 0, limit: int = 100) -> List[models.SafetyStockPolicy]:
    return db.query(models.SafetyStockPolicy).filter(models.SafetyStockPolicy.is_deleted == False).offset(skip).limit(limit).all()

def create_safety_stock_policy(db: Session, policy_in: schemas.SafetyStockPolicyCreate, tenant_id: uuid.UUID) -> models.SafetyStockPolicy:
    # Check if a policy already exists for this item and warehouse
    policy = db.query(models.SafetyStockPolicy).filter(
        models.SafetyStockPolicy.item_id == policy_in.item_id,
        models.SafetyStockPolicy.warehouse_id == policy_in.warehouse_id,
        models.SafetyStockPolicy.is_deleted == False
    ).first()
    
    if policy:
        # Update
        policy.safety_stock_qty = policy_in.safety_stock_qty
        policy.reorder_point_qty = policy_in.reorder_point_qty
        policy.reorder_qty = policy_in.reorder_qty
        policy.lead_time_days = policy_in.lead_time_days
    else:
        # Create new
        policy = models.SafetyStockPolicy(
            item_id=policy_in.item_id,
            warehouse_id=policy_in.warehouse_id,
            safety_stock_qty=policy_in.safety_stock_qty,
            reorder_point_qty=policy_in.reorder_point_qty,
            reorder_qty=policy_in.reorder_qty,
            lead_time_days=policy_in.lead_time_days,
            tenant_id=tenant_id
        )
        db.add(policy)
        
    db.commit()
    db.refresh(policy)
    return policy
