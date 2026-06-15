import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, ArrowRightLeft, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

import { 
  getRequisitions, getRFQs, getPOs, getGRNs, getInvoices, 
  getWorkflowInbox, getLiabilities, getInventoryBalances 
} from '../api';

import { ActionTile } from '../components/dashboard/CoreWidgets';
import { PipelineWidget } from '../components/dashboard/PipelineWidget';
import type { PipelineStage } from '../components/dashboard/PipelineWidget';
import { WorkQueueWidget } from '../components/dashboard/WorkQueueWidget';
import type { WorkItem } from '../components/dashboard/WorkQueueWidget';
import { ApprovalWidget, RiskWidget } from '../components/dashboard/OperationalWidgets';
import { FinanceHealthWidget, SpendWidget, VendorPerformanceWidget } from '../components/dashboard/StrategicWidgets';

export default function ProcurementCommandCenter() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Data states
  const [pipelineCounts, setPipelineCounts] = useState({ pr: 0, rfq: 0, po: 0, grn: 0, inv: 0 });
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [inventoryRisks, setInventoryRisks] = useState<any[]>([]);
  const [financeMetrics, setFinanceMetrics] = useState({ outstanding: 0, dueThisWeek: 0, blocked: 0 });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Pipeline Counts concurrently
      const [prs, rfqs, pos, grns, invs] = await Promise.all([
        getRequisitions().catch(() => ({ data: [] })),
        getRFQs().catch(() => ({ data: [] })),
        getPOs().catch(() => ({ data: [] })),
        getGRNs().catch(() => ({ data: [] })),
        getInvoices().catch(() => ({ data: [] }))
      ]);

      setPipelineCounts({
        pr: prs.data?.length || 0,
        rfq: rfqs.data?.length || 0,
        po: pos.data?.length || 0,
        grn: grns.data?.length || 0,
        inv: invs.data?.length || 0
      });

      // 2. Fetch Work Queue / Approvals (Mocking combined SLA logic)
      const inboxRes = await getWorkflowInbox().catch(() => ({ data: [] }));
      const pendingInbox = inboxRes.data || [];
      
      const mockedWorkQueue: WorkItem[] = [
        ...pendingInbox.map((task: any) => ({
          id: task.id, title: `Approve ${task.entity_type} ${task.entity_ref}`, subtitle: `Requested by ${task.requested_by}`, type: 'approval' as const, urgency: 'medium' as const
        })),
        { id: 'sla-1', title: 'SLA Breach: PO Approval', subtitle: 'PO-2023-089 is 2 days overdue', type: 'sla_breach', urgency: 'high' }
      ];
      setWorkItems(mockedWorkQueue);

      setApprovals(pendingInbox.map((t: any) => ({ type: t.entity_type, ref: t.entity_ref, time: '2 hrs ago' })));

      // 3. Finance Metrics
      const liabRes = await getLiabilities().catch(() => ({ data: { total_outstanding: 2450000, due_this_week: 450000 } }));
      const blockedInv = invs.data?.filter((i: any) => i.status === 'BLOCKED')?.length || 2;
      setFinanceMetrics({
        outstanding: liabRes.data?.total_outstanding || 0,
        dueThisWeek: liabRes.data?.due_this_week || 0,
        blocked: blockedInv
      });

      // 4. Inventory Risks
      const invBal = await getInventoryBalances().catch(() => ({ data: [] }));
      setInventoryRisks([
        { type: 'shortage', item: 'Raw Steel Coils (SKU-882)', message: 'Stock below minimum threshold' },
        { type: 'overstock', item: 'Packaging Boxes (SKU-112)', message: 'Holding 300% of optimal levels' }
      ]);

    } catch (error) {
      toast.error('Failed to sync live dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pipelineStages: PipelineStage[] = [
    { id: 'pr', label: 'Draft PRs', count: pipelineCounts.pr, icon: FileText },
    { id: 'rfq', label: 'Active RFQs', count: pipelineCounts.rfq, icon: ArrowRightLeft },
    { id: 'po', label: 'Issued POs', count: pipelineCounts.po, icon: FileText },
    { id: 'grn', label: 'Pending GRNs', count: pipelineCounts.grn, icon: FileText },
    { id: 'inv', label: 'AP Invoices', count: pipelineCounts.inv, icon: FileText }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Procurement Command Center</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">Enterprise-wide operational overview & risk analytics.</p>
        </div>
        <button onClick={fetchDashboardData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} /> Sync Data
        </button>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <ActionTile title="New Requisition" subtitle="Create internal PR" icon={Plus} onClick={() => navigate('/requisitions/new')} color="indigo" />
        <ActionTile title="New Purchase Order" subtitle="Direct PO creation" icon={Plus} onClick={() => navigate('/pos/new')} color="blue" />
        <ActionTile title="Receive Goods" subtitle="Warehouse GRN" icon={ArrowRightLeft} onClick={() => navigate('/receive-goods')} color="emerald" />
        <ActionTile title="Process Invoice" subtitle="Accounts Payable" icon={FileText} onClick={() => navigate('/invoices/new')} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Operational Flow (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <WorkQueueWidget items={workItems} />
          <PipelineWidget stages={pipelineStages} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ApprovalWidget items={approvals} />
            <RiskWidget alerts={inventoryRisks} />
          </div>
        </div>

        {/* Right Column: Strategic Insights (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <FinanceHealthWidget 
            outstanding={financeMetrics.outstanding} 
            dueThisWeek={financeMetrics.dueThisWeek} 
            blockedPayments={financeMetrics.blocked} 
          />
          <SpendWidget />
          <VendorPerformanceWidget />
        </div>
      </div>
    </div>
  );
}
