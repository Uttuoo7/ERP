import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ClipboardList, CheckSquare, Settings, Layers, Calendar, 
  Cpu, Box, Warehouse, ChevronRight, CheckCircle2, ShoppingBag, ArrowRight
} from 'lucide-react';
import { StandardPageFramework } from '../../components/common/StandardPageFramework';

interface WizardStep {
  title: string;
  description: string;
  actionLabel: string;
  route: string;
  icon: React.ReactNode;
}

export default function WorkflowWizards() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'procurement' | 'manufacturing' | 'inventory'>('procurement');

  // Steps configuration
  const procurementSteps: WizardStep[] = [
    {
      title: "1. Purchase Requisition",
      description: "Raise an internal material requisition and submit for manager approval.",
      actionLabel: "Create Requisition",
      route: "/requisitions/new",
      icon: <FileText className="w-5 h-5" />
    },
    {
      title: "2. Request For Quotation",
      description: "Invite multiple suppliers to bid and compare competitive pricing matrices.",
      actionLabel: "Issue RFQ Bids",
      route: "/rfqs/new",
      icon: <ClipboardList className="w-5 h-5" />
    },
    {
      title: "3. Purchase Order",
      description: "Convert selected quotations or requisitions into an approved PO supplier contract.",
      actionLabel: "Issue Purchase Order",
      route: "/pos/convert",
      icon: <ShoppingBag className="w-5 h-5" />
    },
    {
      title: "4. Receive Goods & QC",
      description: "Log incoming shipment receipts and run dimensional check inspections.",
      actionLabel: "Log Goods Receipt",
      route: "/receive-goods",
      icon: <Box className="w-5 h-5" />
    },
    {
      title: "5. Invoice Matching",
      description: "Run 3-way matching validation and release vendor payment vouchers.",
      actionLabel: "Submit Invoice",
      route: "/invoices/new",
      icon: <CheckSquare className="w-5 h-5" />
    }
  ];

  const manufacturingSteps: WizardStep[] = [
    {
      title: "1. Bill of Materials (BOM)",
      description: "Define raw components, assembly structures, and labor overhead costs.",
      actionLabel: "Configure BOM",
      route: "/manufacturing/boms",
      icon: <Settings className="w-5 h-5" />
    },
    {
      title: "2. Capacity Horizons",
      description: "Execute finite planning calendars and run alternate machine rebalancing.",
      actionLabel: "Plan Alternate Horizons",
      route: "/manufacturing/capacity-planning",
      icon: <Layers className="w-5 h-5" />
    },
    {
      title: "3. Scheduling Timeline",
      description: "Visualize operations sequence on Gantt charts and simulate overtime loads.",
      actionLabel: "Adjust Timeline",
      route: "/manufacturing/production-scheduling",
      icon: <Calendar className="w-5 h-5" />
    },
    {
      title: "4. Shop Floor Execution",
      description: "Provide shop operators a terminal to record hourly workstation progress.",
      actionLabel: "Launch operator panel",
      route: "/manufacturing/shop-floor",
      icon: <Cpu className="w-5 h-5" />
    }
  ];

  const inventorySteps: WizardStep[] = [
    {
      title: "1. Receive Stock",
      description: "Unload docks, record batches/serial logs, and set standard valuation costs.",
      actionLabel: "Open GRN Workspace",
      route: "/grns/convert",
      icon: <Warehouse className="w-5 h-5" />
    },
    {
      title: "2. Stock Movements",
      description: "Configure internal transfers between locations and track in-transit containers.",
      actionLabel: "Manage Transfers",
      route: "/inventory/transfers",
      icon: <Box className="w-5 h-5" />
    },
    {
      title: "3. Cycle Count & Audit",
      description: "Propose regular physical counts, record discrepancies, and adjust ledger values.",
      actionLabel: "Start Cycle Count",
      route: "/inventory/cycle-counts",
      icon: <ClipboardList className="w-5 h-5" />
    }
  ];

  const renderSteps = (steps: WizardStep[]) => (
    <div className="relative border-l-2 border-slate-200 ml-4 pl-8 space-y-8 py-3">
      {steps.map((step, idx) => (
        <div key={idx} className="relative group text-xs font-semibold">
          {/* Indicator Dot */}
          <span className="absolute -left-[42px] top-1.5 rounded-full w-7 h-7 flex items-center justify-center bg-white border-2 border-slate-300 text-slate-500 font-extrabold shadow-sm group-hover:border-blue-500 group-hover:text-blue-600 transition-colors">
            {idx + 1}
          </span>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md hover:border-slate-300">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  {step.icon}
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{step.title}</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold max-w-xl">{step.description}</p>
            </div>
            
            <button
              onClick={() => navigate(step.route)}
              className="px-4 py-2 bg-slate-50 hover:bg-blue-600 border border-slate-200 hover:border-blue-600 text-slate-700 hover:text-white rounded-xl flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-wider shrink-0"
            >
              {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <StandardPageFramework
      title="Guided Workflow Wizards"
      description="Select an end-to-end operational path to navigate through step-by-step transaction forms."
    >
      <div className="p-6 bg-slate-50 space-y-6">
        {/* Tabs switcher */}
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200/60 max-w-md">
          <button
            onClick={() => setActiveTab('procurement')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'procurement' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Procurement Path
          </button>
          <button
            onClick={() => setActiveTab('manufacturing')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'manufacturing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Manufacturing Path
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'inventory' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Inventory Path
          </button>
        </div>

        {/* Wizards Container */}
        <div>
          {activeTab === 'procurement' && renderSteps(procurementSteps)}
          {activeTab === 'manufacturing' && renderSteps(manufacturingSteps)}
          {activeTab === 'inventory' && renderSteps(inventorySteps)}
        </div>
      </div>
    </StandardPageFramework>
  );
}
