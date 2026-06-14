import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { get, post, getGLPeriods } from '../../api';

interface Validations {
  no_negative_inventory: boolean;
  subledger_gl_reconciliation: boolean;
  no_open_adjustments: boolean;
  no_open_cycle_counts: boolean;
  no_in_transit_transfers: boolean;
  all_snapshots_exist: boolean;
  trial_balance_balanced: boolean;
  all_issues_posted: boolean;
}

interface CertificateData {
  period_name: string;
  status: string;
  start_date: string;
  end_date: string;
  subledger_total: number;
  gl_balance: number;
  variance: number;
  validations: Validations;
}

export const InventoryClosingCertificate: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [cert, setCert] = useState<CertificateData | null>(null);

  const fetchPeriods = async () => {
    try {
      const res = await getGLPeriods();
      // Only keep periods, filter deleted ones
      setPeriods(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedPeriodId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load accounting periods.");
    }
  };

  const fetchCertificate = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const res = await get('/inventory/closing-certificate', {
        params: { period_id: selectedPeriodId }
      });
      setCert(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate closing certificate.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    fetchCertificate();
  }, [selectedPeriodId]);

  const handleClosePeriod = async () => {
    if (!selectedPeriodId || !cert) return;
    
    // Check if any validations failed
    const failed = Object.values(cert.validations).some(v => !v);
    if (failed) {
      toast.error("Cannot close period. One or more pre-closure validations failed.");
      return;
    }

    setClosing(true);
    try {
      await post('/inventory/periods/close', null, {
        params: { period_id: selectedPeriodId }
      });
      toast.success("Period closed and locked successfully!");
      fetchCertificate();
      fetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Period close failed.");
    } finally {
      setClosing(false);
    }
  };

  const getValidationRow = (label: string, isOk: boolean, description: string) => {
    return (
      <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-800">{label}</span>
          <p className="text-[10px] text-slate-400 font-semibold">{description}</p>
        </div>
        <div>
          {isOk ? (
            <span className="px-2.5 py-1 text-[10px] font-black text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Passed
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-black text-rose-700 bg-rose-50 rounded-full border border-rose-250 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Blocked
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-650">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-none">Period Closing Certificate</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Verify subledger reconcile, daily snapshots, open transactions, and lock the period</p>
          </div>
        </div>

        {/* Period Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Select Period:</span>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-slate-700 shadow-sm"
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_name} ({p.status})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs font-semibold">Running closure certification validations...</span>
        </div>
      ) : cert ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Validation Checklist Pane */}
          <div className="lg:col-span-2 space-y-4 bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" /> Pre-Closure Verification Matrix
            </h3>
            
            <div className="space-y-3">
              {getValidationRow("A. Negative Inventory Balances", cert.validations.no_negative_inventory, "WarehouseStock hand quantities must be greater than or equal to zero.")}
              {getValidationRow("B. Subledger-to-GL Reconciliation", cert.validations.subledger_gl_reconciliation, "Variance between sum of cost layers value and account 1200 balance must be exactly 0.0.")}
              {getValidationRow("C. Standard Revaluations & Adjustments", cert.validations.no_open_adjustments, "All inventory adjustment documents must be in completed or rejected states.")}
              {getValidationRow("D. Active Cycle Counts", cert.validations.no_open_cycle_counts, "All cycle counts must be approved or rejected (no pending variances).")}
              {getValidationRow("E. Transit Transfers Clearance", cert.validations.no_in_transit_transfers, "No warehouse transfer dispatch documents can remain in IN_TRANSIT.")}
              {getValidationRow("F. Daily Inventory Snapshots", cert.validations.all_snapshots_exist, "A historical snap must exist for every calendar date of the period duration.")}
              {getValidationRow("G. G/L Trial Balance Status", cert.validations.trial_balance_balanced, "Double-entry parity verify (sum debits equals sum credits).")}
              {getValidationRow("H. Material Consumption Logged", cert.validations.all_issues_posted, "All warehouse issues and return receipts must be in POSTED state.")}
            </div>
          </div>

          {/* Certificate & Close Pane */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">
                Certificate Status
              </h3>
              
              <div className="space-y-4 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Period Duration</span>
                  <span className="text-slate-800 font-bold">{cert.start_date} to {cert.end_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Inventory Subledger Value</span>
                  <span className="text-slate-800 font-extrabold">₹{cert.subledger_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">G/L Account 1200 Value</span>
                  <span className="text-slate-800 font-extrabold">₹{cert.gl_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                
                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-slate-500 uppercase tracking-wide">Variance</span>
                  <span className={`text-sm font-black ${cert.variance > 0.001 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{cert.variance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {cert.status.toUpperCase() === "CLOSED" ? (
                <div className="p-4 bg-emerald-50 rounded-xl text-emerald-800 flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="font-bold">Period CLOSED & LOCKED. Stock ledger historical data sealed.</div>
                </div>
              ) : (
                <button
                  disabled={closing}
                  onClick={handleClosePeriod}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5 transition-all"
                >
                  {closing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sealing Ledger...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Certify & Close Period
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center text-slate-400">No closing certificate data.</div>
      )}
    </div>
  );
};
