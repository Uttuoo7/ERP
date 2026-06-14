import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FormSection } from './FormSection';

export interface MatchDetails {
  poMatch: boolean;
  poVariance?: string;
  grnMatch: boolean;
  grnVariance?: string;
  invoiceMatch: boolean;
  invoiceVariance?: string;
}

export const ThreeWayMatchCard: React.FC<{ details: MatchDetails }> = ({ details }) => {
  const isFullyMatched = details.poMatch && details.grnMatch && details.invoiceMatch;

  return (
    <FormSection title="3-Way Match Status" icon={isFullyMatched ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}>
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase w-14">PO</span>
            {details.poMatch ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3" /> Match</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" /> Variance</span>
            )}
          </div>
          {!details.poMatch && details.poVariance && <span className="text-[10px] font-bold text-rose-500">{details.poVariance}</span>}
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase w-14">GRN</span>
            {details.grnMatch ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3" /> Match</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" /> Variance</span>
            )}
          </div>
          {!details.grnMatch && details.grnVariance && <span className="text-[10px] font-bold text-rose-500">{details.grnVariance}</span>}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase w-14">Invoice</span>
            {details.invoiceMatch ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3" /> Match</span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" /> Variance</span>
            )}
          </div>
          {!details.invoiceMatch && details.invoiceVariance && <span className="text-[10px] font-bold text-rose-500">{details.invoiceVariance}</span>}
        </div>
      </div>
    </FormSection>
  );
};
