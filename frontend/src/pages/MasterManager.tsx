import React, { useState } from 'react';
import { 
  Users, Landmark, FolderGit2, Briefcase, UserCheck, Shield, ShoppingBag, Home 
} from 'lucide-react';
import MasterGrid from '../components/MasterGrid';
import type { ColumnDefinition } from '../components/MasterGrid';

interface MasterConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  columns: ColumnDefinition[];
  placeholder: string;
}

const MasterManager: React.FC = () => {
  const configs: MasterConfig[] = [
    {
      id: "employees",
      label: "Employee Master",
      icon: <Users className="w-5 h-5" />,
      placeholder: "Search employees by ID, name, email...",
      columns: [
        { key: "employee_id", label: "Employee ID", type: "string", required: true },
        { key: "first_name", label: "First Name", type: "string", required: true },
        { key: "last_name", label: "Last Name", type: "string", required: true },
        { key: "email", label: "Email Address", type: "string", required: true },
        { key: "phone", label: "Phone Number", type: "string" },
      ]
    },
    {
      id: "customers",
      label: "Customer Master",
      icon: <UserCheck className="w-5 h-5" />,
      placeholder: "Search customers by number, name, email...",
      columns: [
        { key: "customer_number", label: "Customer Number", type: "string", required: true },
        { key: "name", label: "Company Name", type: "string", required: true },
        { key: "email", label: "Billing Email", type: "string", required: true },
        { key: "phone", label: "Contact Phone", type: "string" },
        { key: "gstin", label: "GSTIN", type: "string" },
        { key: "pan", label: "PAN", type: "string" }
      ]
    },
    {
      id: "departments",
      label: "Department Master",
      icon: <Briefcase className="w-5 h-5" />,
      placeholder: "Search departments by code or name...",
      columns: [
        { key: "code", label: "Department Code", type: "string", required: true },
        { key: "name", label: "Department Name", type: "string", required: true },
      ]
    },
    {
      id: "cost-centers",
      label: "Cost Center Master",
      icon: <Landmark className="w-5 h-5" />,
      placeholder: "Search cost centers by code or name...",
      columns: [
        { key: "code", label: "Cost Center Code", type: "string", required: true },
        { key: "name", label: "Cost Center Name", type: "string", required: true },
        { key: "description", label: "Description", type: "string" }
      ]
    },
    {
      id: "projects",
      label: "Project Master",
      icon: <FolderGit2 className="w-5 h-5" />,
      placeholder: "Search projects by code or name...",
      columns: [
        { key: "code", label: "Project Code", type: "string", required: true },
        { key: "name", label: "Project Name", type: "string", required: true },
        { key: "start_date", label: "Start Date", type: "date" },
        { key: "end_date", label: "End Date", type: "date" }
      ]
    }
  ];

  const [activeTab, setActiveTab] = useState<string>("employees");
  const activeConfig = configs.find(c => c.id === activeTab) || configs[0];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Master Data Console Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white p-5 flex flex-col gap-6">
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Master Data Panel</h2>
          <p className="text-sm text-slate-500 mt-1">Foundation Data Layer</p>
        </div>
        
        <nav className="flex flex-col gap-1.5 flex-1">
          {configs.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive 
                    ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Grid View */}
      <main className="flex-1 p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeConfig.label}</h1>
          <p className="text-slate-500 mt-1.5">Manage centralized master configurations for {activeConfig.label.toLowerCase()}</p>
        </div>

        <MasterGrid 
          entity={activeConfig.id}
          entityLabel={activeConfig.label.replace(" Master", "")}
          columns={activeConfig.columns}
          searchPlaceholder={activeConfig.placeholder}
        />
      </main>
    </div>
  );
};

export default MasterManager;
