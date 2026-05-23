import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { getAnalyticsProcurement } from '../../../api';
import { KPICardSkeleton } from '../../components/ui/KPICard';

export function ProcurementDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await getAnalyticsProcurement();
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <KPICardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote conversion rates */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            RFQ Conversion & Quote Efficiency
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <span className="text-[10px] uppercase font-bold text-slate-500">Conversion rate</span>
              <span className="text-2xl font-black text-slate-900 block mt-1">{data?.rfq_conversion_pct}%</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <span className="text-[10px] uppercase font-bold text-slate-500">Calculated savings</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">₹{data?.procurement_savings_inr?.toLocaleString()}</span>
            </div>
          </div>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.po_aging_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vendor spend distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Top Vendors Share
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Vendor Name</th>
                  <th className="pb-3 text-center">Orders</th>
                  <th className="pb-3 text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data?.vendor_spend_distribution?.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-semibold text-slate-900">{item.vendor}</td>
                    <td className="py-3 text-center text-slate-500">{item.po_count}</td>
                    <td className="py-3 text-right text-slate-900 font-bold">₹{item.spend.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
