import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Sparkles, Award, Star, Clock, CheckCircle, ShieldCheck, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRFQComparison, selectRFQVendor } from '../api';

interface ComparisonItem {
  rfq_line_id: string;
  item_sku: string;
  item_name: string;
  required_qty: number;
  vendor_prices: Record<string, number>;
}

interface ComparisonVendor {
  vendor_id: string;
  vendor_name: string;
  total_price: number;
  avg_lead_time: number;
  vendor_rating: number;
  payment_terms: string;
  weighted_score: number;
  is_best_price: boolean;
  is_fastest: boolean;
  is_recommended: boolean;
}

const RFQCompare: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [matrix, setMatrix] = useState<{
    rfq_id: string;
    rfq_number: string;
    items: ComparisonItem[];
    vendors: ComparisonVendor[];
    recommendation_details: string;
  } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await getRFQComparison(id!);
      setMatrix(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, [id]);

  const handleSelectVendor = async (vendorId: string) => {
    setSelecting(true);
    try {
      await selectRFQVendor(id!, vendorId);
      toast.success("Vendor selection approved! Requisition pipeline progressing.");
      navigate(`/rfqs/${id}`);
    } catch (err) {
      // Handled
    } finally {
      setSelecting(false);
    }
  };

  if (loading && !matrix) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs text-slate-400 font-semibold">Running weighted procurement recommendation algorithms...</p>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-bold text-slate-900">RFQ Comparison Matrix Not Loaded</p>
      </div>
    );
  }

  const { rfq_number, items, vendors, recommendation_details } = matrix;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/rfqs/${id}`)}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Quote Comparison Matrix</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Weighted procurement comparison engine for RFQ {rfq_number}</p>
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center space-y-3">
          <Award className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-900">No supplier bids received yet.</p>
            <p className="text-xs text-slate-400 mt-1">Please invite vendors and submit quotations to evaluate side-by-side matrices.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Weighted recommendation card */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-widest leading-none mb-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Optimal Weighted Selection
              </span>
              <p className="text-sm md:text-base font-bold leading-relaxed">{recommendation_details}</p>
            </div>
            
            {vendors.find(v => v.is_recommended) && (
              <button
                onClick={() => handleSelectVendor(vendors.find(v => v.is_recommended)!.vendor_id)}
                disabled={selecting}
                className="whitespace-nowrap px-6 py-3 font-extrabold text-sm text-blue-600 bg-white hover:bg-slate-50 rounded-xl transition-all shadow-md shadow-slate-950/10 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4.5 h-4.5" /> Award Contract
              </button>
            )}
          </div>

          {/* Supplier Grid Contrasts */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-4 w-1/3">Item Details</th>
                    <th className="px-5 py-4 text-center w-24">Required Qty</th>
                    {vendors.map(vendor => (
                      <th key={vendor.vendor_id} className="px-5 py-4 text-center min-w-[180px] border-l border-slate-100">
                        <div className="space-y-1">
                          <span className="font-extrabold text-slate-800 text-sm block">{vendor.vendor_name}</span>
                          <span className="inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                            Score: {vendor.weighted_score}/100
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map(item => (
                    <tr key={item.rfq_line_id} className="hover:bg-slate-50/20">
                      <td className="px-5 py-4.5">
                        <span className="font-bold text-slate-900 text-sm block">{item.item_sku}</span>
                        <span className="text-slate-400 font-semibold mt-0.5 block">{item.item_name}</span>
                      </td>
                      <td className="px-5 py-4.5 text-center font-bold text-slate-800 text-sm">
                        {item.required_qty}
                      </td>
                      {vendors.map(vendor => {
                        const price = item.vendor_prices[vendor.vendor_id];
                        // Check if this is the lowest price for this item
                        const allPrices = Object.values(item.vendor_prices);
                        const isLowest = price && price === Math.min(...allPrices);
                        
                        return (
                          <td key={vendor.vendor_id} className="px-5 py-4.5 text-center border-l border-slate-100">
                            {price ? (
                              <span className={`text-sm ${isLowest ? 'text-emerald-600 font-extrabold flex items-center justify-center gap-1' : 'text-slate-600 font-semibold'}`}>
                                ₹{price.toFixed(2)}
                                {isLowest && <CheckCircle className="w-3.5 h-3.5 fill-emerald-50 text-emerald-600" />}
                              </span>
                            ) : (
                              <span className="text-slate-350 italic">No bid submitted</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  
                  {/* Summary Rows */}
                  <tr className="border-t border-slate-200 bg-slate-50/40">
                    <td className="px-5 py-4 font-bold text-slate-900 text-sm" colSpan={2}>Gross Total Quoted</td>
                    {vendors.map(vendor => (
                      <td key={vendor.vendor_id} className="px-5 py-4 text-center border-l border-slate-100 font-black text-sm text-slate-900">
                        ₹{vendor.total_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-5 py-4 font-bold text-slate-900 text-sm" colSpan={2}>Delivery Lead Time</td>
                    {vendors.map(vendor => (
                      <td key={vendor.vendor_id} className="px-5 py-4 text-center border-l border-slate-100 font-semibold text-slate-700">
                        {vendor.avg_lead_time} days
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-5 py-4 font-bold text-slate-900 text-sm" colSpan={2}>Vendor Reliability</td>
                    {vendors.map(vendor => (
                      <td key={vendor.vendor_id} className="px-5 py-4 text-center border-l border-slate-100">
                        <div className="flex items-center justify-center gap-0.5 text-amber-500 font-bold">
                          <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                          <span>{vendor.vendor_rating.toFixed(1)}</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-5 py-4 font-bold text-slate-900 text-sm" colSpan={2}>Payment Terms</td>
                    {vendors.map(vendor => (
                      <td key={vendor.vendor_id} className="px-5 py-4 text-center border-l border-slate-100 text-slate-500 font-semibold">
                        {vendor.payment_terms}
                      </td>
                    ))}
                  </tr>

                  {/* Actions Row */}
                  <tr className="bg-slate-50/50">
                    <td className="px-5 py-5" colSpan={2}></td>
                    {vendors.map(vendor => (
                      <td key={vendor.vendor_id} className="px-5 py-5 text-center border-l border-slate-100">
                        <button
                          onClick={() => handleSelectVendor(vendor.vendor_id)}
                          disabled={selecting}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                            vendor.is_recommended
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {vendor.is_recommended ? "Award Optimal Option" : "Award Bid Option"}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RFQCompare;
