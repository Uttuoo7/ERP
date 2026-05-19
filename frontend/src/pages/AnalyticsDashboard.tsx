import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  TrendingUp, ShoppingCart, Clock, CheckCircle, 
  Filter, Calendar, ChevronRight, Package, Users, BarChart3, SearchX
} from 'lucide-react';
import { 
  getAnalyticsOverview, 
  getAnalyticsMonthlyTrends, 
  getAnalyticsVendorPerformance, 
  getAnalyticsTopItems, 
  getAnalyticsPOStatusDistribution 
} from '../api';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

const KPISkeleton = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
    <Skeleton className="w-12 h-12 rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="w-20 h-3" />
      <Skeleton className="w-24 h-6" />
    </div>
  </div>
);

const ChartSkeleton = ({ height = "h-[350px]" }) => (
  <div className={`w-full ${height} flex flex-col gap-4`}>
    <div className="flex justify-between items-end h-full gap-2 px-2">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="flex-1" />
      ))}
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex justify-between items-center py-4 border-b border-slate-50">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-24 h-4" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ message = "No data available for the selected range", icon: Icon = BarChart3 }: any) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] py-12 text-slate-400">
    <div className="bg-slate-50 p-4 rounded-full mb-4">
      <Icon className="w-8 h-8 opacity-20" />
    </div>
    <p className="text-sm font-medium">{message}</p>
  </div>
);

const KPICard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-300">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value ?? 0}</h3>
    </div>
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [vendorPerf, setVendorPerf] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [statusDist, setStatusDist] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const [ov, tr, vp, ti, sd] = await Promise.all([
        getAnalyticsOverview(params),
        getAnalyticsMonthlyTrends(params),
        getAnalyticsVendorPerformance(params),
        getAnalyticsTopItems(params),
        getAnalyticsPOStatusDistribution()
      ]);
      setOverview(ov.data.data[0]);
      setTrends(tr.data.data);
      setVendorPerf(vp.data.data);
      setTopItems(ti.data.data);
      setStatusDist(sd.data.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setTimeout(() => setLoading(false), 500); // Small delay for smooth transition
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Procurement Analytics</h1>
          <p className="text-slate-500 mt-1">Real-time insights across your supply chain</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm outline-none border-none bg-transparent"
            />
          </div>
          <div className="h-4 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2 px-3">
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm outline-none border-none bg-transparent"
            />
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Filter className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`space-y-8 transition-opacity duration-500 ${loading ? 'opacity-80' : 'opacity-100'}`}>
        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <>
              <KPISkeleton />
              <KPISkeleton />
              <KPISkeleton />
              <KPISkeleton />
            </>
          ) : (
            <>
              <KPICard 
                title="Total Spend" 
                value={overview?.total_spend ? `₹${overview.total_spend.toLocaleString()}` : "₹0"} 
                icon={TrendingUp} 
                color="bg-indigo-600" 
              />
              <KPICard 
                title="Total POs" 
                value={overview?.total_purchase_orders} 
                icon={ShoppingCart} 
                color="bg-violet-600" 
              />
              <KPICard 
                title="Pending POs" 
                value={overview?.pending_purchase_orders} 
                icon={Clock} 
                color="bg-amber-500" 
              />
              <KPICard 
                title="Approved POs" 
                value={overview?.approved_purchase_orders} 
                icon={CheckCircle} 
                color="bg-emerald-500" 
              />
            </>
          )}
        </div>

        {/* Middle Section: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Monthly Trend */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Monthly Spending Trend</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full uppercase tracking-wider">
                Last 12 Months
              </span>
            </div>
            <div className="h-[350px]">
              {loading ? (
                <ChartSkeleton />
              ) : trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="total_spend" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </div>
          </div>

          {/* PO Status Distribution */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6">PO Status Breakdown</h3>
            <div className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="w-48 h-48 rounded-full" />
                </div>
              ) : statusDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No status data available" />
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Vendor & Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Vendor Performance */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Top Vendors by Spend
            </h3>
            <div className="h-[350px]">
              {loading ? (
                <ChartSkeleton />
              ) : vendorPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorPerf} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="vendor_name" type="category" axisLine={false} tickLine={false} width={100} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="total_spend" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No vendor data found" />
              )}
            </div>
          </div>

          {/* Top Items Table */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Most Purchased Items
            </h3>
            <div className="overflow-x-auto min-h-[350px]">
              {loading ? (
                <TableSkeleton />
              ) : topItems.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-sm font-semibold text-slate-600">Item Name</th>
                      <th className="pb-3 text-sm font-semibold text-slate-600">Qty</th>
                      <th className="pb-3 text-sm font-semibold text-slate-600">Total Spend</th>
                      <th className="pb-3 text-sm font-semibold text-slate-600 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topItems.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-medium text-slate-900">{item.item_name}</td>
                        <td className="py-4 text-slate-600 font-semibold">{item.total_quantity_purchased}</td>
                        <td className="py-4 text-indigo-600 font-bold">₹{item.total_spend.toLocaleString()}</td>
                        <td className="py-4 text-right">
                          <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState message="No item purchase history" icon={SearchX} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
