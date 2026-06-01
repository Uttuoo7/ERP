import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Save, ShieldCheck, ShieldAlert, Sparkles, HelpCircle, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGRN, submitGRNQC } from "../api";

interface GRNLine {
  id: string;
  item_id: string;
  quantity_ordered: number;
  quantity_received: number;
  batch_number?: string;
  expiry_date?: string;
  serial_numbers?: string;
  item?: {
    sku: string;
    name: string;
  };
}

interface QCState {
  quantity_accepted: number;
  quantity_rejected: number;
  quantity_damaged: number;
  batch_number: string;
  expiry_date: string;
  serial_text: string;
  remarks: string;
}

const QCConsole: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inspection states map
  const [qcState, setQcState] = useState<Record<string, QCState>>({});
  const [overallRemarks, setOverallRemarks] = useState("");

  const loadGRNDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getGRN(id);
      setGrn(res.data);
      
      // Seed default QC inspections
      const seeded: Record<string, QCState> = {};
      res.data.line_items.forEach((line: GRNLine) => {
        // default all received counts to accepted
        seeded[line.id] = {
          quantity_accepted: line.quantity_received,
          quantity_rejected: 0,
          quantity_damaged: 0,
          batch_number: line.batch_number || "",
          expiry_date: line.expiry_date ? line.expiry_date.split('T')[0] : "",
          serial_text: line.serial_numbers ? JSON.parse(line.serial_numbers).join('\n') : "",
          remarks: ""
        };
      });
      setQcState(seeded);
    } catch (err) {
      toast.error("Failed to load GRN unloading checklist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGRNDetails();
  }, [id]);

  const handleValChange = (lineId: string, field: keyof QCState, val: any) => {
    setQcState(prev => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: val
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !grn) return;

    // Validate that all lines reconcile counts
    const qcItems = [];
    for (const line of grn.line_items) {
      const state = qcState[line.id];
      if (!state) continue;

      const sum = Number(state.quantity_accepted) + Number(state.quantity_rejected) + Number(state.quantity_damaged);
      if (sum !== line.quantity_received) {
        toast.error(
          `Count Reconciliation Mismatch on SKU ${line.item?.sku}. ` +
          `Expected: ${line.quantity_received}, Sum entered: ${sum}. ` +
          `Please ensure Accepted + Rejected + Damaged counts sum exactly to received quantity.`
        );
        return;
      }

      // parse serials
      const serials = state.serial_text.split('\n')
        .map(x => x.strip ? x.strip() : x.trim())
        .filter(x => x.length > 0);

      qcItems.push({
        line_item_id: line.id,
        quantity_accepted: Number(state.quantity_accepted),
        quantity_rejected: Number(state.quantity_rejected),
        quantity_damaged: Number(state.quantity_damaged),
        batch_number: state.batch_number.trim() || null,
        expiry_date: state.expiry_date ? new Date(state.expiry_date).toISOString() : null,
        serial_numbers: serials,
        remarks: state.remarks.trim() || null
      });
    }

    setSaving(true);
    try {
      const payload = {
        qc_items: qcItems,
        remarks: overallRemarks.trim() || null
      };

      await submitGRNQC(id, payload);
      toast.success("Quality Control inspection submitted and committed to stock ledgers!");
      navigate(`/grns/${id}`);
    } catch (err: any) {
      // Handled
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-xs text-slate-400 font-bold">Mounting Quality Control Console...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/grns/${id}`)}
          className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-500 transition-all border border-slate-200 bg-white"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">QC Quality Inspection Console</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Reconcile physical counts, quarantine damaged packages, and register lot serial tracks</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-500">
        
        {/* Unloaded items checklist cards */}
        {grn?.line_items.map((line: GRNLine) => {
          const state = qcState[line.id] || {
            quantity_accepted: 0,
            quantity_rejected: 0,
            quantity_damaged: 0,
            batch_number: "",
            expiry_date: "",
            serial_text: "",
            remarks: ""
          };

          const sumCount = Number(state.quantity_accepted) + Number(state.quantity_rejected) + Number(state.quantity_damaged);
          const isMatched = sumCount === line.quantity_received;

          return (
            <div key={line.id} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              {/* Item Info Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-3.5">
                <div>
                  <span className="font-extrabold text-blue-600 text-sm block">{line.item?.sku}</span>
                  <span className="text-[11px] text-slate-400 block font-semibold leading-relaxed line-clamp-1">{line.item?.name}</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Unloaded received count</span>
                    <span className="text-base font-black text-slate-900">{line.quantity_received} units</span>
                  </div>

                  <div className={`px-2.5 py-1 rounded-lg border font-black text-[10px] flex items-center gap-1 ${
                    isMatched 
                      ? 'bg-emerald-50 border-emerald-150 text-emerald-700' 
                      : 'bg-rose-50 border-rose-150 text-rose-700'
                  }`}>
                    {isMatched ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> RECONCILED
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 animate-bounce" /> COUNT MISMATCH ({sumCount} entered)
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* QC Counts Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Accepted */}
                <div className="space-y-2">
                  <label className="block text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Accepted Qty Today *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={line.quantity_received}
                    value={state.quantity_accepted}
                    onChange={(e) => handleValChange(line.id, 'quantity_accepted', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-emerald-50/20 focus:border-emerald-500 text-emerald-950 font-bold text-sm"
                  />
                </div>

                {/* Rejected */}
                <div className="space-y-2">
                  <label className="block text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Rejected Qty Today *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={line.quantity_received}
                    value={state.quantity_rejected}
                    onChange={(e) => handleValChange(line.id, 'quantity_rejected', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-rose-50/20 focus:border-rose-500 text-rose-950 font-bold text-sm"
                  />
                </div>

                {/* Damaged */}
                <div className="space-y-2">
                  <label className="block text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Damaged / Quarantine Qty *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={line.quantity_received}
                    value={state.quantity_damaged}
                    onChange={(e) => handleValChange(line.id, 'quantity_damaged', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-indigo-50/20 focus:border-indigo-500 text-indigo-950 font-bold text-sm"
                  />
                </div>

              </div>

              {/* Lot batches & Serial list binds */}
              <div className="border-t border-slate-50 pt-5 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Allocate Lot Batch & Serial codes
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Batch code */}
                  <div className="space-y-2">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider">Lot Batch Number</label>
                    <input
                      type="text"
                      placeholder="e.g. LOT-2026-X8"
                      value={state.batch_number}
                      onChange={(e) => handleValChange(line.id, 'batch_number', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    />
                  </div>

                  {/* Expiry */}
                  <div className="space-y-2">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider">Expiry Date</label>
                    <input
                      type="date"
                      value={state.expiry_date}
                      onChange={(e) => handleValChange(line.id, 'expiry_date', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* Serials */}
                <div className="space-y-2">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider">Serial Numbers list (One code per line)</label>
                  <textarea
                    placeholder="e.g.&#10;SN-A884399&#10;SN-A884400"
                    value={state.serial_text}
                    onChange={(e) => handleValChange(line.id, 'serial_text', e.target.value)}
                    className="w-full min-h-[80px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-mono resize-none"
                  />
                </div>
              </div>

              {/* Line Remarks */}
              <div className="space-y-2 border-t border-slate-50 pt-5">
                <label className="block text-slate-400 font-bold uppercase tracking-wider">Line QC remarks / comments</label>
                <textarea
                  placeholder="e.g. Packing box slightly wet, but items inside completely undamaged..."
                  value={state.remarks}
                  onChange={(e) => handleValChange(line.id, 'remarks', e.target.value)}
                  className="w-full min-h-[60px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none"
                />
              </div>

            </div>
          );
        })}

        {/* Inspection remarks */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <label className="block text-slate-900 font-extrabold text-sm uppercase tracking-wider">Overall quality control comments *</label>
          <textarea
            required
            placeholder="Provide summary of overall QC inspector decisions..."
            value={overallRemarks}
            onChange={(e) => setOverallRemarks(e.target.value)}
            className="w-full min-h-[90px] p-3 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => navigate(`/grns/${id}`)}
            className="px-5 py-2.5 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-250 transition-all font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 font-bold"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Committing QC...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Save QC Inspections
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default QCConsole;
