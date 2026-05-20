import logging
from typing import Dict, Any, List
from . import models

logger = logging.getLogger(__name__)

def generate_comparison_matrix(rfq: models.RequestForQuotation) -> Dict[str, Any]:
    """
    Computes weighted supplier comparisons, pricing highlights, and procurement recommendations.
    """
    logger.info(f"RFQ Comparison Engine: Contrasting {len(rfq.quotations)} quotation bids for RFQ {rfq.rfq_number}")
    
    # 1. Map items
    items_list = []
    for line in rfq.line_items:
        prices_map = {}
        for quote in rfq.quotations:
            # Locate matching line item in quote
            matching_line = next((q_line for q_line in quote.line_items if q_line.rfq_line_id == line.id), None)
            if matching_line:
                prices_map[str(quote.vendor_id)] = float(matching_line.unit_price)
                
        items_list.append({
            "rfq_line_id": line.id,
            "item_sku": line.item.sku,
            "item_name": line.item.name,
            "required_qty": float(line.quantity),
            "vendor_prices": prices_map
        })
        
    # 2. Map and normalize bidder scores
    vendors_list = []
    
    if rfq.quotations:
        # Calculate total pricing, lead times, and ratings
        quote_metrics = []
        for quote in rfq.quotations:
            total_p = sum(float(l.unit_price * line_map.quantity) 
                          for l in quote.line_items 
                          for line_map in rfq.line_items 
                          if l.rfq_line_id == line_map.id)
            
            avg_lead = float(quote.lead_time_days)
            rating = float(getattr(quote.vendor, "rating", 4.2)) if getattr(quote.vendor, "rating", None) else 4.2
            
            quote_metrics.append({
                "quote": quote,
                "total_price": total_p,
                "avg_lead_time": avg_lead,
                "rating": rating
            })
            
        min_price = min(m["total_price"] for m in quote_metrics) if quote_metrics else 1.0
        min_lead = min(m["avg_lead_time"] for m in quote_metrics) if quote_metrics else 1.0
        
        # Norm and compute weighted scores
        for m in quote_metrics:
            quote = m["quote"]
            total_price = m["total_price"]
            avg_lead_time = m["avg_lead_time"]
            rating = m["rating"]
            
            # Scores (0 to 100)
            price_score = (min_price / total_price) * 100 if total_price > 0 else 0
            delivery_score = (min_lead / avg_lead_time) * 100 if avg_lead_time > 0 else 0
            rating_score = (rating / 5.0) * 100
            
            # Weighted overall index: Price 50%, Lead Time 30%, Vendor Rating 20%
            weighted = (0.50 * price_score) + (0.30 * delivery_score) + (0.20 * rating_score)
            
            vendors_list.append({
                "vendor_id": quote.vendor_id,
                "vendor_name": quote.vendor.name,
                "total_price": total_price,
                "avg_lead_time": avg_lead_time,
                "vendor_rating": rating,
                "payment_terms": quote.payment_terms or "Standard",
                "weighted_score": float(round(weighted, 2)),
                "is_best_price": False,
                "is_fastest": False,
                "is_recommended": False
            })
            
        # Highlight best markers
        if vendors_list:
            lowest_v = min(vendors_list, key=lambda x: x["total_price"])
            lowest_v["is_best_price"] = True
            
            fastest_v = min(vendors_list, key=lambda x: x["avg_lead_time"])
            fastest_v["is_fastest"] = True
            
            optimal_v = max(vendors_list, key=lambda x: x["weighted_score"])
            optimal_v["is_recommended"] = True
            
            recommendation = (
                f"Based on our weighted procurement criteria, supplier '{optimal_v['vendor_name']}' is recommended "
                f"with an optimal score of {optimal_v['weighted_score']}/100. "
                f"They offer a balanced portfolio with total price of ₹{optimal_v['total_price']:,.2f} "
                f"and delivery within {optimal_v['avg_lead_time']:.0f} days."
            )
        else:
            recommendation = "No quotation responses collected yet."
    else:
        recommendation = "Add vendor bid responses to trigger the weighted recommendation matrix."
        
    return {
        "rfq_id": rfq.id,
        "rfq_number": rfq.rfq_number,
        "items": items_list,
        "vendors": vendors_list,
        "recommendation_details": recommendation
    }
