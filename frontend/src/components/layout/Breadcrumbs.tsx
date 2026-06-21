import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const location = useLocation();
  const cleanPath = location.pathname;

  if (cleanPath === '/dashboard') return null;

  // Resolve path segments to logical labels
  const getBreadcrumbs = () => {
    const segments = cleanPath.split('/').filter(Boolean);
    const crumbs: { label: string; path?: string }[] = [{ label: 'Dashboard', path: '/dashboard' }];

    let currentPath = '';
    segments.forEach((seg, idx) => {
      currentPath += `/${seg}`;
      
      let label = seg.toUpperCase();
      
      // Standard mapping checks for pretty labels
      if (seg === 'pos') label = 'Purchase Orders';
      else if (seg === 'rfqs') label = 'Requests For Quotes';
      else if (seg === 'requisitions') label = 'Purchase Requisitions';
      else if (seg === 'grns') label = 'Warehouse Receipts (GRN)';
      else if (seg === 'coa') label = 'Chart of Accounts';
      else if (seg === 'invoices') label = 'Vendor Invoices';
      else if (seg === 'workflows') label = 'Workflow Config';
      else if (seg === 'adjust') label = 'Adjustments';
      else if (seg === 'transfers') label = 'Transfers';
      else if (seg === 'cycle-counts') label = 'Cycle Counts';
      else if (seg === 'valuation') label = 'Inventory Valuation';
      else if (seg === 'boms') label = 'Bill of Materials';
      else if (seg === 'work-orders') label = 'Work Orders';
      else if (seg === 'shop-floor') label = 'Shop Floor';
      
      // If it looks like a database record ID (contains numbers, starts with PO-, Req-, GRN- etc)
      if (seg.match(/^[0-9]+$/) || seg.startsWith('PO-') || seg.startsWith('REQ-') || seg.startsWith('INV-') || seg.startsWith('GRN-')) {
        label = seg;
      }

      crumbs.push({
        label,
        path: idx === segments.length - 1 ? undefined : currentPath // no link on final segment
      });
    });

    return crumbs;
  };

  const crumbs = getBreadcrumbs();

  return (
    <div className="h-8 px-6 bg-white border-b border-slate-200/80 flex items-center select-none font-sans shrink-0 text-[10px]">
      <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider">
        <Home className="w-3 h-3 text-slate-400" />
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            {crumb.path ? (
              <Link 
                to={crumb.path} 
                className="hover:text-blue-600 hover:underline transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-700 font-extrabold">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
