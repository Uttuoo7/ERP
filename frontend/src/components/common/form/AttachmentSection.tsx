import React from 'react';
import { Paperclip, UploadCloud, FileText, Trash2 } from 'lucide-react';
import { FormSection } from './FormSection';

export interface Attachment {
  id: string;
  name: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface AttachmentSectionProps {
  attachments: Attachment[];
  onUpload?: () => void;
  onDelete?: (id: string) => void;
}

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({ attachments, onUpload, onDelete }) => {
  return (
    <FormSection title="Supporting Documents" icon={<Paperclip className="w-4 h-4" />}>
      <div className="space-y-4">
        {attachments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.map(att => (
              <div key={att.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors bg-slate-50/50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-white rounded shadow-sm border border-slate-100">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{att.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium truncate">{att.size} • {att.uploadedBy} • {att.uploadedAt}</p>
                  </div>
                </div>
                {onDelete && (
                  <button type="button" onClick={() => onDelete(att.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
            <Paperclip className="w-6 h-6 text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-600">No attachments found</p>
            <p className="text-xs text-slate-400 mt-1">Upload relevant documents to support this record.</p>
          </div>
        )}
        
        {onUpload && (
          <button type="button" onClick={onUpload} className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
            <UploadCloud className="w-4.5 h-4.5" /> Upload File
          </button>
        )}
      </div>
    </FormSection>
  );
};
