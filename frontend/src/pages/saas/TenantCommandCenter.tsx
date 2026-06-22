import React, { useEffect, useState } from 'react';
import { Building, Shield, Settings, Server, Globe, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table } from 'antd';
import { get } from '../../api';

export function TenantCommandCenter() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/saas/tenants')
    .then(res => {
      setTenants(res.data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const columns = [
    { title: 'Tenant ID', dataIndex: 'id', key: 'id', render: (text: string) => <span className="font-mono text-xs text-gray-500">{text.split('-')[0]}</span> },
    { title: 'Workspace Name', dataIndex: 'name', key: 'name', render: (text: string) => <strong className="text-indigo-600">{text}</strong> },
    { title: 'Domain', dataIndex: 'domain', key: 'domain', render: (text: string) => <span className="text-gray-500">{text}.erp.app</span> },
    { title: 'Plan', dataIndex: 'subscription_plan', key: 'subscription_plan', render: (text: string) => <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">{text}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (text: string) => <span className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/>{text}</span> }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Server className="w-8 h-8 text-indigo-600" />
            Global Platform Command Center
          </h1>
          <p className="text-slate-500 mt-2">Manage Multi-Tenant SaaS Infrastructure & Billing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">Active Tenants</p>
                <p className="text-4xl font-bold mt-2">{tenants.length}</p>
              </div>
              <Building className="w-10 h-10 text-indigo-200 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Platform Health</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">99.99%</p>
              </div>
              <Shield className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="w-5 h-5 text-indigo-500" />
            Active SaaS Workspaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table 
            dataSource={tenants} 
            columns={columns} 
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            className="border border-slate-100 rounded-lg overflow-hidden"
          />
        </CardContent>
      </Card>
    </div>
  );
}
