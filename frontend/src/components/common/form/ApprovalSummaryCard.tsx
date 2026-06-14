import React from 'react';
import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
import { FormSection } from './FormSection';

export interface ApprovalDetails {
  currentApprover: string;
  nextApprover?: string;
  approvalLevel: string;
  slaDueDate?: string;
  escalationStatus: 'Normal' | 'Warning' | 'Escalated';
}

export const ApprovalSummaryCard: React.FC<{ details: ApprovalDetails }> = ({ details }) => {
  const isEscalated = details.escalationStatus === 'Escalated';
  const isWarning = details.escalationStatus === 'Warning';
  
  return (
    <FormSection title="Approval Routing" icon={<ShieldCheck className="w-4 h-4" />}>
      <div className="space-y-3.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase">Stage</span>
          <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">{details.approvalLevel}</span>
        </div>
        
        <div className="space-y-1 pb-2.5 border-b border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Approver</span>
          <span className="text-sm font-semibold text-slate-900">{details.currentApprover}</span>
        </div>

        {details.nextApprover && (
          <div className="space-y-1 pb-2.5 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Next In Line</span>
            <span className="text-sm font-semibold text-slate-600">{details.nextApprover}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 uppercase">SLA Due</span>
          </div>
          <span className="text-[11px] font-bold text-slate-900">{details.slaDueDate || 'N/A'}</span>
        </div>

        {(isEscalated || isWarning) && (
          <div className={`mt-3 p-2 rounded-lg flex items-start gap-2 border ${isEscalated ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] font-bold">
              {isEscalated ? 'SLA Breached - Escalated' : 'SLA Warning - Approaching Due'}
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
};
