import React, { useState, useEffect } from 'react';
import { Search, Filter, FileCheck, Eye, Download, Printer } from 'lucide-react';
import api from "../../api";

export function DocumentCommandCenter() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      const res = await api.get('/pos');
      setPurchaseOrders(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPreview = async (poId: string) => {
    setSelectedPoId(poId);
    setHtmlContent(null);
    try {
      const res = await api.get(`/commercial-documents/preview/purchase-order/${poId}`);
      setHtmlContent(res.data.html);
    } catch (e) {
      console.error(e);
      setHtmlContent('<div style="padding: 20px; color: red;">Failed to load PDF preview.</div>');
    }
  };

  const handlePrint = () => {
    if (!htmlContent) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <FileCheck className="w-8 h-8 text-indigo-600" />
          Document Command Center
        </h1>
        <p className="text-slate-500 mt-1">Live preview and generate enterprise-grade commercial documents (PDFs).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[750px]">
        {/* Left Column: List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Search POs..." className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-500 bg-white hover:bg-slate-50"><Filter className="w-4 h-4" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {purchaseOrders.map(po => (
              <div 
                key={po.id}
                onClick={() => loadPreview(po.id)}
                className={`p-3 rounded-xl cursor-pointer border transition-colors ${selectedPoId === po.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-800">{po.po_number}</div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{po.status}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm font-bold text-slate-700">${po.total_amount.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{new Date(po.order_date).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: PDF Preview Render */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden relative">
          {selectedPoId ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="font-bold text-slate-700 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-500" /> Print-Ready Preview
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition">
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-200 p-8 overflow-y-auto flex justify-center">
                {htmlContent ? (
                  <div 
                    className="bg-white shadow-xl origin-top"
                    style={{ width: '800px', minHeight: '1056px', transform: 'scale(0.85)', marginBottom: '-10%' }}
                    dangerouslySetInnerHTML={{ __html: htmlContent }} 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 mt-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    Generating PDF Render...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <FileCheck className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a Purchase Order to preview its commercial PDF.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
