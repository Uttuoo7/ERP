import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText, Sparkles, Database, FileDigit } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MonitorProps {
  queueId: string;
}

const ProcessingMonitor: React.FC<MonitorProps> = ({ queueId }) => {
  const [status, setStatus] = useState<string>('QUEUED');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  
  useEffect(() => {
    // We listen to the global NEW_NOTIFICATION event which our WS store dispatches.
    // The backend uses event_dispatcher to emit "ocr_progress" and the WS manager relays it.
    const handleOCRProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      
      // We expect the payload from backend to be slightly modified or we just use the raw type
      // Our backend notification engine sends {"type": "OCR_PROGRESS", ...} maybe?
      // Wait, in `ocr_tasks.py` we used `event_dispatcher.dispatch("ocr_progress")`.
      // We need to ensure the event_dispatcher is wired to WebSocket manager for 'ocr_progress'.
      // For now, we will assume it's arriving as NEW_NOTIFICATION with a specific type.
      
      if (payload.type === 'OCR_PROGRESS' && payload.queue_id === queueId) {
        setStatus(payload.status);
        if (payload.invoice_id) setInvoiceId(payload.invoice_id);
        if (payload.confidence) setConfidence(payload.confidence);
      }
    };

    window.addEventListener('NEW_NOTIFICATION', handleOCRProgress);
    return () => window.removeEventListener('NEW_NOTIFICATION', handleOCRProgress);
  }, [queueId]);

  const steps = [
    { key: 'QUEUED', label: 'Uploaded & Queued', icon: FileText },
    { key: 'EXTRACTING', label: 'AI Extraction', icon: Sparkles },
    { key: 'MATCHING', label: '3-Way Match & Anomaly Detection', icon: Database },
    { key: 'COMPLETE', label: 'Invoice Generated', icon: FileDigit }
  ];

  const getCurrentStepIndex = () => {
    if (status === 'FAILED') return 4;
    return steps.findIndex(s => s.key === status);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 w-full max-w-2xl mx-auto space-y-8 mt-6">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Ingestion Progress</h3>
        <p className="text-sm font-semibold text-slate-500">
          Tracking Queue ID: <span className="font-mono text-xs">{queueId.split('-')[0]}...</span>
        </p>
      </div>

      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${(Math.max(0, currentIndex) / (steps.length - 1)) * 100}%` }}
        />
        
        {steps.map((step, idx) => {
          const isCompleted = currentIndex > idx || status === 'COMPLETE';
          const isCurrent = currentIndex === idx && status !== 'COMPLETE' && status !== 'FAILED';
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border-2 ${
                isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 
                isCurrent ? 'bg-white border-blue-600 text-blue-600 shadow-lg shadow-blue-600/20' : 
                'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                 isCurrent ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                 <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs font-bold w-24 text-center ${
                isCompleted || isCurrent ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {status === 'FAILED' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Extraction Failed</h4>
            <p className="text-xs font-medium mt-1">The AI engine could not process this document. Please review it manually.</p>
          </div>
        </div>
      )}

      {status === 'COMPLETE' && invoiceId && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <h4 className="font-bold text-sm">Extraction Successful</h4>
            </div>
            {confidence && (
              <span className={`px-2 py-1 rounded text-xs font-black ${
                confidence > 85 ? 'bg-emerald-200 text-emerald-900' : 
                confidence > 60 ? 'bg-amber-200 text-amber-900' : 'bg-rose-200 text-rose-900'
              }`}>
                {confidence}% Confidence
              </span>
            )}
          </div>
          <p className="text-xs font-medium">Invoice record generated automatically.</p>
          <Link to={`/invoices`} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg text-center transition-colors">
            View Invoice Detail Workspace
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProcessingMonitor;
