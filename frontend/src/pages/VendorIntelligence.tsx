import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, 
  Activity, ArrowRight, Zap, Target
} from 'lucide-react';
import { useAuthStore } from "../store/authStore";
import toast from 'react-hot-toast';

interface VendorScorecard {
  vendor_id: string;
  vendor_name: string;
  overall_score: number;
  delivery_score: number;
  quality_score: number;
  pricing_score: number;
  anomaly_count: number;
  recommendation_tier: string;
}

interface IntelligenceData {
  top_vendors: VendorScorecard[];
  risk_warnings: any[];
  metrics: {
    total_vendors_scored: number;
  };
}

const VendorIntelligence: React.FC = () => {
  const { token } = useAuthStore();
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analytics/vendors`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(response.data);
      } catch (err) {
        toast.error('Failed to load Vendor Intelligence data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [token]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-600 animate-pulse" />
          <span className="text-sm font-bold text-slate-500">Aggregating Vendor Intelligence...</span>
        </div>
      </div>
    );
  }

  const vendors = data?.top_vendors || [];
  const warnings = data?.risk_warnings || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Supplier Intelligence & Risk</h1>
        <p className="text-slate-500 font-semibold mt-2">Executive scorecards and anomaly detection powered by historical spend aggregations.</p>
      </div>

      {warnings.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-200 text-rose-800 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-rose-900">Active Risk Warnings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warnings.map((w, idx) => (
              <div key={idx} className="bg-white border border-rose-100 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 truncate">{w.vendor_name}</span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded ${
                    w.tier === 'RESTRICTED' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {w.tier}
                  </span>
                </div>
                <p className="text-xs text-rose-600 font-semibold">{w.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            Vendor Performance Scorecards
          </h3>
          <span className="text-xs font-bold text-slate-400">Scored {data?.metrics.total_vendors_scored} active vendors</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-wider">
                <th className="p-4 font-black">Vendor</th>
                <th className="p-4 font-black">Overall Score</th>
                <th className="p-4 font-black">Delivery</th>
                <th className="p-4 font-black">Quality</th>
                <th className="p-4 font-black">Pricing</th>
                <th className="p-4 font-black">Anomalies</th>
                <th className="p-4 font-black">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <p>No vendor scorecards generated yet.</p>
                    <p className="text-xs font-medium mt-1">Background aggregations may not have run today.</p>
                  </td>
                </tr>
              ) : (
                vendors.map(v => (
                  <tr key={v.vendor_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 text-slate-900 font-bold">{v.vendor_name}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${
                          v.overall_score > 90 ? 'text-emerald-600' :
                          v.overall_score > 70 ? 'text-blue-600' : 'text-rose-600'
                        }`}>
                          {v.overall_score}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">{v.delivery_score}%</td>
                    <td className="p-4">{v.quality_score}%</td>
                    <td className="p-4">{v.pricing_score}%</td>
                    <td className="p-4">
                      {v.anomaly_count > 0 ? (
                        <span className="text-rose-600 font-black bg-rose-50 px-2 py-1 rounded">
                          {v.anomaly_count} detected
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wide ${
                        v.recommendation_tier === 'PREFERRED' ? 'bg-emerald-100 text-emerald-800' :
                        v.recommendation_tier === 'STANDARD' ? 'bg-slate-100 text-slate-600' :
                        v.recommendation_tier === 'ON_WATCH' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {v.recommendation_tier.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VendorIntelligence;
