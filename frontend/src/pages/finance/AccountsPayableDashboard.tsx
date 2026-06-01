import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, AlertTriangle, CheckCircle, TrendingDown, Clock } from 'lucide-react';
import api from "../../api";

export function AccountsPayableDashboard() {
  const [agingData, setAgingData] = useState<any>(null);

  useEffect(() => {
    fetchAging();
  }, []);

  const fetchAging = async () => {
    try {
      const res = await api.get('/finance/aging-report');
      setAgingData(res.data);
    } catch (e) {
      console.error("Failed to fetch aging report", e);
    }
  };

  if (!agingData) return <div className="p-10 text-center text-slate-500">Loading AP Analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            Accounts Payable Command Center
          </h1>
          <p className="text-slate-500 mt-1">Enterprise liability tracking and vendor aging analytics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">Total Liability</h3>
          </div>
          <div className="text-3xl font-black text-slate-800">${agingData.total_liability.toLocaleString()}</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">0-30 Days</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">${agingData.buckets['0-30'].toLocaleString()}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold text-slate-700">31-60 Days</h3>
          </div>
          <div className="text-2xl font-black text-slate-800">${agingData.buckets['31-60'].toLocaleString()}</div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-5 bg-rose-50 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-rose-800">90+ Days Overdue</h3>
          </div>
          <div className="text-2xl font-black text-rose-900">${agingData.buckets['90+'].toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-indigo-500" /> Top Vendor Exposure
        </div>
        <div className="p-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-slate-500 border-b border-slate-200">
                <th className="pb-3 font-medium">Vendor Name</th>
                <th className="pb-3 font-medium text-right">Total Outstanding Balance</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {agingData.top_vendors.map((v: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-4 font-medium text-slate-800">{v.name}</td>
                  <td className="py-4 font-black text-slate-800 text-right">${v.total_due.toLocaleString()}</td>
                  <td className="py-4 text-right">
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">Requires Action</span>
                  </td>
                </tr>
              ))}
              {agingData.top_vendors.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">No outstanding liabilities</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
