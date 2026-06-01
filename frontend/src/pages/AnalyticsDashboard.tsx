import React, { useState } from 'react';
import { useAuthStore } from "../store/authStore";
import { ExecutiveDashboard } from './dashboards/ExecutiveDashboard';
import { ProcurementDashboard } from './dashboards/ProcurementDashboard';
import { FinanceDashboard } from './dashboards/FinanceDashboard';
import { Building, TrendingUp, Landmark } from 'lucide-react';

const AnalyticsDashboard: React.FC = () => {
  const role = useAuthStore(state => state.user?.role);
  
  const isSuper = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isProcurement = role === 'PROCUREMENT_MANAGER' || isSuper;
  const isFinance = role === 'FINANCE_MANAGER' || isSuper;

  // Default tab logic based on role
  const [activeTab, setActiveTab] = useState<'executive' | 'procurement' | 'finance'>(
    isSuper ? 'executive' : isProcurement ? 'procurement' : 'finance'
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Role-based Tab Switcher (only show if user has access to multiple) */}
      {isSuper && (
        <div className="px-8 pt-6 border-b border-slate-200">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('executive')}
              className={`px-4 py-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'executive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building className="w-4 h-4" /> Executive Command
            </button>
            <button
              onClick={() => setActiveTab('procurement')}
              className={`px-4 py-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'procurement' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Procurement Spend
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 py-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'finance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Landmark className="w-4 h-4" /> Finance & AP
            </button>
          </div>
        </div>
      )}

      {/* Render the selected dashboard */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'executive' && <ExecutiveDashboard />}
        {activeTab === 'procurement' && <ProcurementDashboard />}
        {activeTab === 'finance' && <FinanceDashboard />}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
