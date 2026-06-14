import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ProcessingMonitor from '../components/ocr/ProcessingMonitor';
import axios from 'axios';
import { useAuthStore } from "../store/authStore";

const SmartInvoiceIngestion: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [queueId, setQueueId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      toast.error('Please upload a PDF or Image file.');
      return;
    }
    setSelectedFile(file);
    setQueueId(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/invoices/ocr/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setQueueId(response.data.queue_id);
      toast.success('Document uploaded for AI extraction!');
    } catch (error) {
      toast.error('Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Smart Ingestion Workspace</h1>
        <p className="text-slate-500 font-semibold mt-2">Upload vendor invoices for AI-powered data extraction, automated PO matching, and anomaly detection.</p>
      </div>

      {!queueId ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              dragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={handleChange}
            />
            
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto">
                <UploadCloud className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Drag & drop document</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">Supports PDF, PNG, JPG up to 10MB.</p>
              </div>
              <button 
                onClick={() => inputRef.current?.click()}
                className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm transition-all"
              >
                Browse Files
              </button>
            </div>
          </div>

          {selectedFile && (
            <div className="mt-6 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                  <FileType className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{selectedFile.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {uploading ? 'Uploading...' : 'Extract Data'}
                  {!uploading && <Sparkles className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProcessingMonitor queueId={queueId} />
      )}
      
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Auto PO Matching</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">The AI engine automatically cross-references extracted lines with existing Purchase Orders.</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Smart Data Extraction</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">No templates required. Extracts Vendor, Date, Taxes, and Amounts from any format.</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Fraud Detection</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Analyzes historical velocity and flags duplicate vendor invoices automatically.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartInvoiceIngestion;
