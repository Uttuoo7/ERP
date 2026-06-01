import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from "../../store/authStore";

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 flex items-center gap-2 ${
        isActive 
          ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100' 
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar() {
  const role = useAuthStore(state => state.user?.role);
  const email = useAuthStore(state => state.user?.email);
  const logout = useAuthStore(state => state.logout);
  
  const isSuper = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN' || isSuper;
  const isProcurement = role === 'PROCUREMENT_MANAGER' || role === 'BUYER' || isAdmin;
  const isFinance = role === 'FINANCE_MANAGER' || role === 'FINANCE' || isAdmin;
  const isWarehouse = role === 'WAREHOUSE_MANAGER' || role === 'WAREHOUSE' || isAdmin;
  const isEmployee = role === 'EMPLOYEE' || role === 'ADMIN';

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
      <div className="h-16 px-6 flex flex-col justify-center border-b border-slate-200 shrink-0">
        <h2 className="text-lg font-black tracking-tight text-slate-900">P2P ERP</h2>
        <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase truncate">
          {email}
        </p>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Workplace</div>
          <div className="space-y-0.5">
            <SidebarLink to="/inbox">Approval Tasks Inbox</SidebarLink>
            <SidebarLink to="/notifications">My Alerts Feed</SidebarLink>
          </div>
        </div>

        {isProcurement && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Insights</div>
            <div className="space-y-0.5">
              <SidebarLink to="/analytics">Command Cockpit</SidebarLink>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Administration</div>
              <div className="space-y-0.5">
                <SidebarLink to="/masters">Master Data Engine</SidebarLink>
                <SidebarLink to="/workflows/builder">Workflows Setup</SidebarLink>
                <SidebarLink to="/sla/builder">SLA Automation Builder</SidebarLink>
                <SidebarLink to="/sla/escalations">Escalation Console</SidebarLink>
                <SidebarLink to="/rbac/matrix">RBAC Roles Matrix</SidebarLink>
                <SidebarLink to="/integrations">Enterprise Integrations</SidebarLink>
                <SidebarLink to="/data-migration/wizard">Data Migration Wizard</SidebarLink>
                <SidebarLink to="/data-migration/history">Import Audit Logs</SidebarLink>
              </div>
            </div>
            
            <div className="pt-2">
              <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observability</h3>
              <div className="space-y-0.5">
                <SidebarLink to="/observability/health">System Health</SidebarLink>
                <SidebarLink to="/observability/queues">Queue Monitor</SidebarLink>
                <SidebarLink to="/observability/api-errors">Error Analytics</SidebarLink>
              </div>
            </div>
          </>
        )}

        {(isProcurement || isEmployee) && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Purchasing & RFQ</div>
            <div className="space-y-0.5">
              <SidebarLink to="/requisitions">Purchase Requisitions</SidebarLink>
              {isProcurement && (
                <>
                  <SidebarLink to="/rfqs">Requests For Quotations</SidebarLink>
                  <SidebarLink to="/vendors">Vendors Registry</SidebarLink>
                  <SidebarLink to="/pos">Purchase Orders</SidebarLink>
                </>
              )}
            </div>
          </div>
        )}
        
        {isWarehouse && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Warehouse & Receipts</div>
            <div className="space-y-0.5">
              <SidebarLink to="/inventory">Stock Ledgers</SidebarLink>
              <SidebarLink to="/grns">Warehouse Receipts (GRN)</SidebarLink>
            </div>
          </div>
        )}

        {isFinance && (
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2">Accounts Payable</div>
            <div className="space-y-0.5">
              <SidebarLink to="/invoices">Vendor Invoices</SidebarLink>
              <SidebarLink to="/finance/liabilities">Accrued Liabilities</SidebarLink>
              <SidebarLink to="/finance/ledger">G/L Postings Explorer</SidebarLink>
              <SidebarLink to="/finance/tally">Tally ERP Queue</SidebarLink>
              <SidebarLink to="/finance/tally/mapping">Tally Ledger Mapping</SidebarLink>
              <SidebarLink to="/finance/tally/reconciliation">Tally Reconciliation</SidebarLink>
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          Logout Session
        </button>
      </div>
    </aside>
  );
}
