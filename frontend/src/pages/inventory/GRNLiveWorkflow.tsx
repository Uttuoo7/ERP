import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, XCircle, FileText, Settings, ArrowRight } from 'lucide-react';
import api from "../../api";

export function GRNLiveWorkflow() {
  const [grns, setGrns] = useState<any[]>([]);
  const [selectedGrn, setSelectedGrn] = useState<any>(null);

  useEffect(() => {
    fetchGrns();
  }, []);

  const fetchGrns = async () => {
    try {
      const res = await api.get('/grns');
      setGrns(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGrnDetails = async (id: string) => {
    try {
      const res = await api.get(`/grns/${id}`);
      setSelectedGrn(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateLine = async (lineId: string, accepted: number, rejected: number) => {
    if (!selectedGrn) return;
    try {
      await api.put(`/grns/${selectedGrn.id}/lines/${lineId}?accepted_qty=${accepted}&rejected_qty=${rejected}`);
      loadGrnDetails(selectedGrn.id);
    } catch (e) {
      console.error(e);
      alert("Failed to update line");
    }
  };

  const handleAcceptGRN = async () => {
    if (!selectedGrn) return;
    try {
      await api.post(`/grns/${selectedGrn.id}/accept`);
      alert("GRN Accepted successfully. Inventory updated.");
      loadGrnDetails(selectedGrn.id);
      fetchGrns();
    } catch (e: any) {
      console.error(e);
      alert(e.response?.data?.detail || "Failed to accept GRN");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Truck className="w-8 h-8 text-indigo-600" />
          GRN Execution Workflow
        </h1>
        <p className="text-slate-500 mt-1">Process inbound material, log rejections, and update enterprise stock ledger.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[750px]">
        {/* Left Column: List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
            Pending Deliveries
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {grns.map(g => (
              <div 
                key={g.id}
                onClick={() => loadGrnDetails(g.id)}
                className={`p-3 rounded-xl cursor-pointer border transition-colors ${selectedGrn?.id === g.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-800">{g.grn_number}</div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${g.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{g.status}</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-slate-500">
                  <div>Challan: {g.delivery_challan_number}</div>
                  <div>PO: {g.po_id.substring(0, 8)}...</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Processing */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden relative">
          {selectedGrn ? (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">{selectedGrn.grn_number}</h2>
                    <div className="text-sm text-slate-500 flex items-center gap-4">
                      <span>Vehicle: {selectedGrn.vehicle_details || 'N/A'}</span>
                      <span>Challan: {selectedGrn.delivery_challan_number}</span>
                    </div>
                  </div>
                  {selectedGrn.status === 'APPROVED' && (
                    <button 
                      onClick={handleAcceptGRN}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition"
                    >
                      Process & Update Ledger <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-5">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-400" /> Material Line Items
                </h3>
                <div className="space-y-4">
                  {selectedGrn.line_items?.map((line: any) => (
                    <div key={line.id} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-bold text-slate-800">{line.item_id}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            Ordered: {line.quantity_ordered} | Previously Rcvd: {line.previously_received_qty}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-700">${line.unit_price} / unit</div>
                          <div className="text-xs text-indigo-600 font-medium">GST: {line.gst_percent}%</div>
                        </div>
                      </div>

                      {selectedGrn.status === 'APPROVED' ? (
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div>
                            <label className="block text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Accepted Qty
                            </label>
                            <input 
                              type="number" 
                              className="w-full border-emerald-200 rounded text-sm p-1 focus:ring-emerald-500" 
                              value={line.accepted_qty}
                              onChange={e => handleUpdateLine(line.id, parseInt(e.target.value) || 0, line.rejected_qty)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-rose-700 mb-1 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Rejected Qty
                            </label>
                            <input 
                              type="number" 
                              className="w-full border-rose-200 rounded text-sm p-1 focus:ring-rose-500" 
                              value={line.rejected_qty}
                              onChange={e => handleUpdateLine(line.id, line.accepted_qty, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="text-sm">Accepted: <span className="font-bold text-emerald-600">{line.accepted_qty}</span></div>
                          <div className="text-sm">Rejected: <span className="font-bold text-rose-600">{line.rejected_qty}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 border-t border-slate-100 bg-white">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Subtotal</div>
                    <div className="font-bold text-slate-800">${selectedGrn.subtotal}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">CGST / SGST</div>
                    <div className="font-bold text-slate-800">${selectedGrn.cgst} / ${selectedGrn.sgst}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">IGST</div>
                    <div className="font-bold text-slate-800">${selectedGrn.igst}</div>
                  </div>
                  <div className="border-l border-slate-200">
                    <div className="text-xs text-indigo-600 font-bold mb-1">Total Valuation</div>
                    <div className="font-black text-slate-800 text-lg">${selectedGrn.total_amount}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Settings className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a GRN to process material receipts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
