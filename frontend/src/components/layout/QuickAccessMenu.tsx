import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, FileText, ShoppingBag, Receipt, Truck, ClipboardList, Navigation, UserPlus, Box 
} from 'lucide-react';
import toast from 'react-hot-toast';

export function QuickAccessMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleAction = (path: string, label: string) => {
    navigate(path);
    setIsOpen(false);
    toast.success(`Launching ${label} transaction.`);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const actions = [
    { label: 'New Purchase Order', path: '/pos/new', icon: <ShoppingBag className="w-3.5 h-3.5 text-blue-600" /> },
    { label: 'New Requisition (PR)', path: '/requisitions/new', icon: <FileText className="w-3.5 h-3.5 text-indigo-600" /> },
    { label: 'New Invoice', path: '/invoices/new', icon: <Receipt className="w-3.5 h-3.5 text-violet-600" /> },
    { label: 'New Goods Receipt (GRN)', path: '/grns/convert', icon: <Truck className="w-3.5 h-3.5 text-amber-600" /> },
    { label: 'New Work Order', path: '/manufacturing/work-orders', icon: <ClipboardList className="w-3.5 h-3.5 text-emerald-600" /> },
    { label: 'New Stock Adjustment', path: '/inventory/adjust', icon: <Navigation className="w-3.5 h-3.5 text-rose-600" /> },
    { label: 'New Vendor Profile', path: '/vendors', icon: <UserPlus className="w-3.5 h-3.5 text-cyan-600" /> },
    { label: 'New Item Catalog SKU', path: '/items', icon: <Box className="w-3.5 h-3.5 text-slate-600" /> }
  ];

  return (
    <div ref={dropdownRef} className="relative select-none font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-xl transition-all flex items-center justify-center border border-slate-200 shadow-sm bg-white"
        title="Quick Create Menu (Transactions)"
      >
        <Plus className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2.5 animate-scale-in">
          <div className="px-3.5 pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Quick Transactions
            </span>
          </div>

          <div className="flex flex-col gap-0.5 mt-1.5 max-h-[300px] overflow-y-auto">
            {actions.map((act, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(act.path, act.label)}
                className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <div className="p-1 bg-slate-50 rounded-lg shrink-0">
                  {act.icon}
                </div>
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
