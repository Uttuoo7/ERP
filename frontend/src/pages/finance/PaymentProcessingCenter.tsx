import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, ChevronRight, AlertCircle, Banknote, Upload } from 'lucide-react';
import api from "../../api";

export function PaymentProcessingCenter() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVouchers, setSelectedVouchers] = useState<any[]>([]);
  
  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [bankName, setBankName] = useState('');
  const [accountRef, setAccountRef] = useState('');
  const [narration, setNarration] = useState('');
  const [customAmount, setCustomAmount] = useState<string>('');

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchPendingVouchers(selectedVendorId);
      setSelectedVouchers([]);
    } else {
      setVouchers([]);
    }
  }, [selectedVendorId]);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingVouchers = async (vendorId: string) => {
    try {
      // Assuming we fetch all AP Vouchers for vendor that are not PAID
      const res = await api.get(`/ap/vouchers?vendor_id=${vendorId}`);
      const pending = res.data.filter((v: any) => v.payment_status !== 'PAID');
      setVouchers(pending);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVoucher = (voucher: any) => {
    if (selectedVouchers.find(v => v.id === voucher.id)) {
      setSelectedVouchers(selectedVouchers.filter(v => v.id !== voucher.id));
    } else {
      setSelectedVouchers([...selectedVouchers, voucher]);
    }
  };

  const calculateTotalAllocated = () => {
    if (customAmount) return parseFloat(customAmount);
    return selectedVouchers.reduce((sum, v) => sum + parseFloat(v.balance_amount), 0);
  };

  const handleExecutePayment = async () => {
    if (selectedVouchers.length === 0) return alert("Select at least one AP Voucher");
    
    const amountToPay = calculateTotalAllocated();
    if (amountToPay <= 0) return alert("Payment amount must be greater than 0");

    try {
      const payload = {
        vendor_id: selectedVendorId,
        payment_method: paymentMethod,
        bank_name: bankName,
        account_reference: accountRef,
        payment_amount: amountToPay,
        narration: narration,
        allocations: selectedVouchers.map(v => ({
          ap_id: v.id,
          amount: parseFloat(v.balance_amount) // Assuming full allocation for simplicity
        }))
      };

      await api.post('/payments/execute', payload);
      alert("Payment Voucher Generated and Submitted for Approval!");
      
      // Reset form
      setSelectedVouchers([]);
      setCustomAmount('');
      setBankName('');
      setAccountRef('');
      setNarration('');
      fetchPendingVouchers(selectedVendorId);
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.detail || "Failed to execute payment");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-indigo-600" />
            Payment Processing Center
          </h1>
          <p className="text-slate-500 mt-1">Execute allocations, deduct TDS, and release vendor payments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[750px]">
        {/* Left Column: AP Selection */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
            1. Select Payee & Liabilities
          </div>
          <div className="p-4 border-b border-slate-100">
            <select 
              className="w-full border-slate-200 rounded-lg text-sm shadow-sm p-2"
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
            >
              <option value="">Select Vendor...</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {vouchers.map(v => (
              <div 
                key={v.id}
                onClick={() => toggleVoucher(v)}
                className={`p-4 rounded-xl cursor-pointer border-2 transition-colors ${selectedVouchers.find(s => s.id === v.id) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-slate-800">{v.ap_number}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.payment_status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {v.payment_status}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-slate-500">
                    <div>Inv Amount: ${v.invoice_amount}</div>
                    <div>TDS Deducted: ${v.tds_amount}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Balance Due</div>
                    <div className="text-lg font-black text-slate-800">${v.balance_amount}</div>
                  </div>
                </div>
              </div>
            ))}
            {selectedVendorId && vouchers.length === 0 && (
              <div className="text-center p-8 text-slate-400 text-sm">No pending liabilities found.</div>
            )}
            {!selectedVendorId && (
              <div className="text-center p-8 text-slate-400 text-sm">Select a vendor to load AP Vouchers.</div>
            )}
          </div>
        </div>

        {/* Right Column: Execution Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
            <span>2. Payment Allocation & Execution</span>
            {selectedVouchers.length > 0 && <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{selectedVouchers.length} Vouchers Selected</span>}
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-8">
            {/* Payment Meta */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Payment Method</label>
                <select 
                  className="w-full border-slate-200 rounded-lg shadow-sm"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (IMPS/RTGS/NEFT)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Total Payment Amount ($)</label>
                <input 
                  type="number" 
                  placeholder={calculateTotalAllocated().toString()}
                  className="w-full border-slate-200 rounded-lg shadow-sm font-bold text-lg"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty to auto-calculate full allocation</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Bank Name / Wallet</label>
                <input 
                  type="text" 
                  className="w-full border-slate-200 rounded-lg shadow-sm"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Account / UTR Reference</label>
                <input 
                  type="text" 
                  className="w-full border-slate-200 rounded-lg shadow-sm"
                  value={accountRef}
                  onChange={e => setAccountRef(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Narration (Appears on Statement)</label>
              <textarea 
                className="w-full border-slate-200 rounded-lg shadow-sm" 
                rows={3}
                value={narration}
                onChange={e => setNarration(e.target.value)}
              ></textarea>
            </div>

            {/* Allocation Summary */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-indigo-500" /> Allocation Preview
              </h4>
              <div className="space-y-3">
                {selectedVouchers.map(v => (
                  <div key={v.id} className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                    <span className="font-medium text-slate-600">{v.ap_number}</span>
                    <span className="font-bold text-slate-800">${v.balance_amount}</span>
                  </div>
                ))}
                {selectedVouchers.length === 0 && <div className="text-sm text-slate-400">No vouchers selected for allocation.</div>}
              </div>
              
              <div className="mt-6 flex justify-between items-center border-t border-slate-200 pt-4">
                <span className="text-lg font-bold text-slate-700">Total Debit (Payment)</span>
                <span className="text-2xl font-black text-indigo-700">${calculateTotalAllocated().toLocaleString()}</span>
              </div>
            </div>
            
            <div className="flex bg-amber-50 p-4 rounded-xl border border-amber-200 gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Important:</strong> Executing this payment will generate a Payment Voucher and send it to the Finance Manager for final approval. The Vendor Ledger will update upon release.
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
            <button 
              onClick={handleExecutePayment}
              disabled={selectedVouchers.length === 0}
              className="bg-indigo-600 disabled:bg-slate-300 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition"
            >
              <Upload className="w-5 h-5" /> Execute Payment & Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
