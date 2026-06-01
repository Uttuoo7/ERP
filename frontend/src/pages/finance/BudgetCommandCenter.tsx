import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import api from "../../api";

export function BudgetCommandCenter() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const response = await api.get('/budgets/intelligence/executive-insights');
      setInsights(response.data);
    } catch (error) {
      console.error('Failed to fetch budget insights', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-lg font-medium text-slate-700">Analyzing Enterprise Spend...</h3>
        <p className="text-slate-500">Executing AI consumption models</p>
      </div>
    );
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-indigo-600" />
            Budget Command Center
          </h1>
          <p className="text-slate-500 mt-1 text-lg">Executive Spend Governance & AI Intelligence</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchInsights} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            Recalculate
          </button>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md">
            Allocation Manager
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium">Enterprise Health Score</h3>
            <Activity className={`w-5 h-5 ${getHealthColor(insights?.global_health_score || 0)}`} />
          </div>
          <div className="mt-4">
            <span className={`text-4xl font-bold tracking-tight ${getHealthColor(insights?.global_health_score || 0)}`}>
              {insights?.global_health_score}
            </span>
            <span className="text-slate-500 ml-1">/ 100</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium">Total Allocated Budget</h3>
            <DollarSign className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-slate-800">
              ${(insights?.total_allocated || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-500 font-medium">Total Consumed Spend</h3>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-slate-800">
              ${(insights?.total_consumed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-2xl shadow-sm border border-indigo-400 flex flex-col justify-between text-white">
          <div className="flex justify-between items-start">
            <h3 className="text-indigo-100 font-medium">Active Budgets</h3>
            <Activity className="w-5 h-5 text-indigo-200" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-bold tracking-tight">
              {insights?.total_active_budgets || 0}
            </span>
          </div>
        </div>
      </div>

      {/* AI Intelligence Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            AI Spend Intelligence & Risk Analysis
          </h2>
          {insights?.anomalies_detected > 0 && (
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {insights.anomalies_detected} Risks Detected
            </span>
          )}
        </div>
        
        <div className="p-6">
          {insights?.insights && insights.insights.length > 0 ? (
            <div className="space-y-4">
              {insights.insights.map((insight: any, idx: number) => (
                <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 ${insight.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className={`mt-1 ${insight.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'}`}>
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className={`text-lg font-bold ${insight.severity === 'CRITICAL' ? 'text-red-800' : 'text-amber-800'}`}>
                      {insight.insight_type.replace(/_/g, ' ')}: {insight.dimension}
                    </h4>
                    <p className={`mt-1 ${insight.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-700'}`}>
                      {insight.recommendation}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-sm font-medium">
                      <span className="bg-white/60 px-3 py-1 rounded-md">Budget: {insight.budget_name}</span>
                      <span className="bg-white/60 px-3 py-1 rounded-md">Utilization: {insight.utilization_percent}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No Imminent Spend Risks</h3>
              <p className="text-slate-500 max-w-md mt-2">All budgets are tracking within expected safe limits. AI models have not detected any runaway velocity or anomalies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
