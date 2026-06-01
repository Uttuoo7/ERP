import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, XCircle } from 'lucide-react';
import api from "../../api";

export function ImportCenter() {
  const [module, setModule] = useState('vendors');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownloadTemplate = () => {
    window.open(`http://127.0.0.1:8000/api/bulk/templates/${module}`, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setError('');
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/bulk/import/preview/${module}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await api.post(`/bulk/import/commit/${module}`, preview.preview_data);
      alert(`Import completed! Status: ${res.data.status}. Successful: ${res.data.successful_rows}`);
      setFile(null);
      setPreview(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Commit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Upload className="w-8 h-8 text-indigo-600" />
          Data Import Center
        </h1>
        <p className="text-slate-500 mt-1">Bulk upload enterprise master data and transactions via Excel or CSV.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">1. Select Target Module</label>
            <select 
              className="w-full border-slate-200 rounded-lg shadow-sm p-3"
              value={module}
              onChange={e => setModule(e.target.value)}
            >
              <option value="vendors">Vendors (Master)</option>
              <option value="items">Items & Inventory (Master)</option>
              <option value="warehouses">Warehouses (Master)</option>
              <option value="boms">Bill of Materials (Master)</option>
            </select>
          </div>
          
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-indigo-800">Need the correct format?</div>
              <div className="text-sm text-indigo-600">Download the enterprise template with instructions.</div>
            </div>
            <button 
              onClick={handleDownloadTemplate}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Template
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">2. Upload Filled Template</label>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer relative">
            <input 
              type="file" 
              accept=".xlsx,.csv" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <div className="font-bold text-slate-700">Drag & Drop or Click to Browse</div>
            <div className="text-sm text-slate-500 mt-1">{file ? file.name : "Supports .xlsx and .csv"}</div>
          </div>
          
          <button 
            onClick={handlePreview}
            disabled={!file || loading}
            className="w-full bg-slate-800 text-white px-6 py-3 rounded-xl font-bold disabled:bg-slate-300 hover:bg-slate-900 transition"
          >
            {loading ? "Validating..." : "Analyze & Preview Import"}
          </button>
          
          {error && <div className="text-rose-600 text-sm font-medium">{error}</div>}
        </div>
      </div>

      {preview && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">3. Import Validation Preview</h3>
            <div className="flex gap-4 text-sm font-bold">
              <span className="text-slate-500">Total: {preview.total_rows}</span>
              <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Valid: {preview.valid_count}</span>
              <span className="text-rose-600 flex items-center gap-1"><XCircle className="w-4 h-4" /> Invalid: {preview.invalid_count}</span>
            </div>
          </div>
          
          <div className="max-h-[400px] overflow-auto p-0">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white sticky top-0 shadow-sm z-10">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="p-3 font-medium w-16">Row</th>
                  <th className="p-3 font-medium w-24">Status</th>
                  <th className="p-3 font-medium">Validation Notes</th>
                  <th className="p-3 font-medium">Raw Data Preview</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview_data.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-500">{row.row_index}</td>
                    <td className="p-3">
                      {row.is_valid ? 
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">READY</span> : 
                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">ERROR</span>
                      }
                    </td>
                    <td className="p-3 text-rose-600 font-medium">{row.error_msg || '-'}</td>
                    <td className="p-3 font-mono text-xs text-slate-600 truncate max-w-xs">{JSON.stringify(row.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
            <button 
              onClick={() => {setPreview(null); setFile(null);}}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleCommit}
              disabled={preview.valid_count === 0 || loading}
              className="bg-indigo-600 disabled:bg-slate-300 text-white px-8 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
            >
              {preview.invalid_count > 0 && <AlertTriangle className="w-4 h-4" />}
              Commit {preview.valid_count} Valid Rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
