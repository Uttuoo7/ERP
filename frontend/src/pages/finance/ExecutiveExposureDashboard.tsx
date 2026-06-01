import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, AlertTriangle, Info, Clock, RefreshCw } from 'lucide-react';
import api from "../../api";

export function ExecutiveExposureDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExposure();
  }, []);

  const fetchExposure = async () => {
    try {
      const response = await api.get('/budgets/intelligence/commitment-exposure');
      setData(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-lg font-medium text-slate-700">Crunching Exposure Data...</h3>
      </div>
    );
  }

  const utilizationPct = data?.exposure?.total_budget > 0 
    ? (data.exposure.total_exposure / data.exposure.total_budget) * 100 
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <PieChart className="w-8 h-8 text-indigo-600" />
          Financial Exposure Dashboard
        </h1>
        <p className="text-slate-500 mt-1 text-lg">AI-powered predictive exposure and total liability tracking.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 font-medium">Total Assigned Budget</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(data?.exposure?.total_budget)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 border-l-4 border-l-indigo-500">
          <h3 className="text-indigo-600 font-bold flex items-center gap-2">
            Total Exposure
            <Info className="w-4 h-4 text-slate-400" />
          </h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(data?.exposure?.total_exposure)}</p>
          <p className="text-sm text-slate-500 mt-1">Planned + Committed + Accrued</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 border-l-4 border-l-amber-500">
          <h3 className="text-amber-600 font-bold">Unrecognized Accruals (GRN)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(data?.exposure?.breakdown?.accrued)}</p>
          <p className="text-sm text-slate-500 mt-1">Pending Invoice Matching</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-500">
          <h3 className="text-emerald-600 font-bold">Actual Liabilities</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(data?.exposure?.breakdown?.actual)}</p>
          <p className="text-sm text-slate-500 mt-1">Approved Invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecasts */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              AI Exhaustion Forecasts
            </h2>
          </div>
          <div className="p-6">
            {data?.forecasts && data.forecasts.length > 0 ? (
              <div className="space-y-4">
                {data.forecasts.map((f: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-xl flex items-start gap-4 border-slate-200">
                    <AlertTriangle className={`w-6 h-6 ${f.predicted_days_to_exhaustion < 15 ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">Allocation: {f.department_id}</h4>
                      <p className="text-slate-600 text-sm mt-1">{f.recommendation}</p>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded">Utilized: {f.current_utilization_pct}%</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {f.predicted_days_to_exhaustion} Days to Exhaustion
                        </span>
                        <span className="text-indigo-600 font-medium">AI Confidence: {Math.round(f.confidence_score)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                AI has not detected any immediate exposure risks.
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Donut */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-bold text-slate-800">Exposure Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400"></div> Planned (PR)</span>
                <span className="font-bold text-slate-800">{formatCurrency(data?.exposure?.breakdown?.planned)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> Committed (PO)</span>
                <span className="font-bold text-slate-800">{formatCurrency(data?.exposure?.breakdown?.committed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Accrued (GRN)</span>
                <span className="font-bold text-slate-800">{formatCurrency(data?.exposure?.breakdown?.accrued)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-slate-600 font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Actual (INV)</span>
                <span className="font-bold text-slate-800">{formatCurrency(data?.exposure?.breakdown?.actual)}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm mb-2">Overall Budget Utilized</p>
              <p className="text-4xl font-bold text-indigo-600">{utilizationPct.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
