import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, ShieldCheck, Plus, Search, Calendar, Landmark, Receipt, ArrowRight, Loader2, BarChart3, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLiabilities, getPayablesAging, recordVendorPayment, getMasterList } from '../api';

const APLiabilityDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [agingList, setAgingList] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  
  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [refNo, setRefNo] = useState("");
  
  // Allocation mappings
  const [vendorOpenLiabilities, setVendorOpenLiabilities] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const agingRes = await getPayablesAging();
      setAgingList(agingRes.data);

      const liabRes = await getLiabilities();
      setLiabilities(liabRes.data);

      const venRes = await getMasterList("vendors", {});
      setVendors(venRes.data);
    } catch (err) {
      toast.error("Failed to load payables data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch liabilities for the chosen vendor to allocate the payment
  useEffect(() => {
    if (selectedVendor) {
      const filtered = liabilities.filter(l => l.vendor_id === selectedVendor && l.outstanding_amount > 0);
      setVendorOpenLiabilities(filtered);
      // reset allocations
      setAllocations({});
    } else {
      setVendorOpenLiabilities([]);
      setAllocations({});
    }
  }, [selectedVendor, liabilities]);

  const handleAllocationChange = (liabId: string, val: string) => {
    setAllocations(prev => ({
      ...prev,
      [liabId]: val
    }));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !paymentAmount || !refNo.trim()) {
      toast.error("Please supply all required payment fields.");
      return;
    }

    const payVal = parseFloat(paymentAmount);
    if (isNaN(payVal) || payVal <= 0) {
      toast.error("Please specify a valid payment amount.");
      return;
    }

    // Prepare allocations list
    const allocList = Object.entries(allocations)
      .map(([liabId, amtStr]) => {
        const amt = parseFloat(amtStr);
        return {
          vendor_liability_id: liabId,
          allocated_amount: isNaN(amt) ? 0 : amt
        };
      })
      .filter(x => x.allocated_amount > 0);

    const allocTotal = allocList.reduce((sum, x) => sum + x.allocated_amount, 0);
    if (allocTotal !== payVal) {
      toast.error(`Allocated total (₹${allocTotal.toFixed(2)}) must exactly match the payment amount (₹${payVal.toFixed(2)}).`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await recordVendorPayment({
        vendor_id: selectedVendor,
        amount: payVal,
        payment_method: paymentMethod,
        reference_number: refNo.trim(),
        invoice_allocations: allocList
      });
      toast.success("Payment recorded and posted successfully!");
      setShowPaymentModal(false);
      // reset states
      setSelectedVendor("");
      setPaymentAmount("");
      setRefNo("");
      setAllocations({});
      fetchData();
    } catch (err: any) {
      // Error handled
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Calculations
  const grandOutstanding = liabilities.reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
  const overdueLiabilities = liabilities.filter(l => new Date(l.due_date) < new Date() && l.outstanding_amount > 0);
  const totalOverdueAmount = overdueLiabilities.reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
  
  // Aggregate Aging Buckets
  const sumAging = agingList.reduce((acc, curr) => {
    acc.current += parseFloat(curr.current_bucket);
    acc.b30_60 += parseFloat(curr.bucket_30_60);
    acc.b60_90 += parseFloat(curr.bucket_60_90);
    acc.bOver90 += parseFloat(curr.bucket_over_90);
    return acc;
  }, { current: 0, b30_60: 0, b60_90: 0, bOver90: 0 });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">AP & Vendor Liability Dashboard</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Operational payables management, liability aging buckets, and payment allocations</p>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
        >
          <Plus className="w-4.5 h-4.5" />
          Record Vendor Payment
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Consolidating financial balances...</p>
        </div>
      ) : (
        <>
          {/* Reusable Liability Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Payables</span>
                <span className="text-lg font-black text-slate-900">₹{grandOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overdue Commitments</span>
                <span className="text-lg font-black text-rose-600">₹{totalOverdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Invoices (This Month)</span>
                <span className="text-lg font-black text-slate-900">
                  {liabilities.filter(l => l.status === 'PAID').length} invoices
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Accounts Payable</span>
                <span className="text-lg font-black text-slate-900">{agingList.length} vendors</span>
              </div>
            </div>
          </div>

          {/* Aging Buckets Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="w-4.5 h-4.5 text-blue-600" /> Payables Overdue Aging Analysis
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current (0 - 30 Days)</span>
                <span className="text-base font-black text-slate-800">₹{sumAging.current.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">31 - 60 Days Due</span>
                <span className="text-base font-black text-amber-700">₹{sumAging.b30_60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-orange-50/40 p-4 rounded-xl border border-orange-100">
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block">61 - 90 Days Due</span>
                <span className="text-base font-black text-orange-700">₹{sumAging.b60_90.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block">Over 90 Days Due</span>
                <span className="text-base font-black text-rose-700">₹{sumAging.bOver90.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Vendor Outstanding breakdown */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Vendor Payables Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-3 py-3">Vendor Name</th>
                      <th className="px-3 py-3 text-right">0 - 30 Days</th>
                      <th className="px-3 py-3 text-right">31 - 60 Days</th>
                      <th className="px-3 py-3 text-right">61 - 90 Days</th>
                      <th className="px-3 py-3 text-right">91+ Days</th>
                      <th className="px-3 py-3 text-right">Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {agingList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">No active outstanding vendor balances.</td>
                      </tr>
                    ) : (
                      agingList.map((aging, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20">
                          <td className="px-3 py-3.5 font-bold text-slate-800">{aging.vendor_name}</td>
                          <td className="px-3 py-3.5 text-right text-slate-500">₹{parseFloat(aging.current_bucket).toFixed(2)}</td>
                          <td className="px-3 py-3.5 text-right text-amber-600">₹{parseFloat(aging.bucket_30_60).toFixed(2)}</td>
                          <td className="px-3 py-3.5 text-right text-orange-600">₹{parseFloat(aging.bucket_60_90).toFixed(2)}</td>
                          <td className="px-3 py-3.5 text-right text-rose-600">₹{parseFloat(aging.bucket_over_90).toFixed(2)}</td>
                          <td className="px-3 py-3.5 text-right font-black text-slate-900">₹{parseFloat(aging.total_outstanding).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Liabilities invoices list */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest">Active Invoices Aging Timeline</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {liabilities.filter(l => l.outstanding_amount > 0).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No active open invoice liabilities.</p>
                ) : (
                  liabilities.filter(l => l.outstanding_amount > 0).map(liab => {
                    const isOverdue = new Date(liab.due_date) < new Date();
                    return (
                      <div key={liab.id} className="p-3.5 rounded-xl border border-slate-150 bg-slate-50/50 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-600">Inv: {liab.invoice?.invoice_number || 'OP-INV'}</span>
                          <span className={`px-2 py-0.5 rounded-[10px] text-[9px] font-black ${isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isOverdue ? 'Overdue' : 'Active'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Vendor: {liab.vendor?.name}</span>
                          <span className="font-bold text-slate-800">Due: {new Date(liab.due_date).toLocaleDateString()}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center text-xs">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Outstanding balance</span>
                          <span className="font-black text-slate-900">₹{parseFloat(liab.outstanding_amount).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- Record Vendor Payment Modal --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xl max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-base font-extrabold text-slate-900">Record Vendor Cash Outflow</h3>
              <p className="text-xs text-slate-400 mt-0.5">Logs debit/credit offsets, applies manual payment allocations, and enqueues sync tasks.</p>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs font-semibold text-slate-500">
              <div className="grid grid-cols-2 gap-4">
                {/* Vendor Picker */}
                <div className="space-y-1.5 col-span-2">
                  <label className="block text-slate-400 font-bold uppercase">Vendor *</label>
                  <select
                    required
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800 font-bold"
                  >
                    <option value="">-- Choose Vendor to Pay --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount Paid */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase">Total Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 50000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  />
                </div>

                {/* Reference Number */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase">Transaction / UTR Reference *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UTR-9984322"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-1.5 col-span-2">
                  <label className="block text-slate-400 font-bold uppercase">Payment Mode / Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-slate-50 focus:border-blue-500 text-slate-800"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash Account</option>
                    <option value="Cheque">Cheque Draft</option>
                  </select>
                </div>
              </div>

              {/* Outstanding Allocation Block */}
              {selectedVendor && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apply payment allocations to open invoices</span>
                  
                  {vendorOpenLiabilities.length === 0 ? (
                    <p className="text-[10px] text-slate-400 py-3 text-center">No open invoices for this vendor.</p>
                  ) : (
                    <div className="space-y-3 max-h-[180px] overflow-y-auto">
                      {vendorOpenLiabilities.map(liab => (
                        <div key={liab.id} className="flex items-center justify-between gap-4 text-[11px] border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-bold text-slate-850 block">Inv: {liab.invoice?.invoice_number || 'INV'}</span>
                            <span className="text-[9px] text-slate-400 font-semibold block">Outstanding balance: ₹{parseFloat(liab.outstanding_amount).toFixed(2)} | Due: {new Date(liab.due_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-bold">Allocate:</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={allocations[liab.id] || ""}
                              onChange={(e) => handleAllocationChange(liab.id, e.target.value)}
                              className="w-28 px-2 py-1 text-center border border-slate-200 rounded bg-white text-xs text-slate-800"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200/80 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1.5"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Recording...
                    </>
                  ) : (
                    "Record & Apply"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default APLiabilityDashboard;
