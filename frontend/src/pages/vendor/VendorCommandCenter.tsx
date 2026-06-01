import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Inbox, Package, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function VendorCommandCenter() {
  const [data, setData] = useState({
    active_rfqs: 0,
    pending_pos: 0,
    active_pos: 0,
    lifetime_paid: 0
  });

  useEffect(() => {
    fetch('http://localhost:8000/api/portal/vendor/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(res => res.json())
    .then(setData)
    .catch(console.error);
  }, []);

  const chartData = [
    { name: 'Jan', revenue: 4000 },
    { name: 'Feb', revenue: 3000 },
    { name: 'Mar', revenue: 2000 },
    { name: 'Apr', revenue: 2780 },
    { name: 'May', revenue: 1890 },
    { name: 'Jun', revenue: 2390 },
    { name: 'Jul', revenue: 3490 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500">Here is your operational summary for today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active RFQs</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-3xl font-bold text-slate-900">{data.active_rfqs}</p>
                  {data.active_rfqs > 0 && <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>}
                </div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Inbox className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Pending PO Acknowledgement</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-3xl font-bold text-slate-900">{data.pending_pos}</p>
                  {data.pending_pos > 0 && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active Orders</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{data.active_pos}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Lifetime Revenue</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">${data.lifetime_paid.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-2 h-2 mt-2 rounded-full bg-indigo-500 shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">New RFQ Received</p>
                    <p className="text-xs text-slate-500 mt-1">RFQ-2026-{1000+i} requires your attention before Friday.</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
