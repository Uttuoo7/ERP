import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, CheckCircle, Clock, Loader2, AlertCircle, File } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { uploadAttachment, getAttachments } from '../../api';

interface Attachment {
  id: string;
  file_name: string;
  file_url?: string;
  document_type?: string;
  source_type?: string;
  status?: string;
  uploaded_at?: string;
}

interface DocumentSection {
  key: string;
  label: string;
  description: string;
}

const DOCUMENT_SECTIONS: DocumentSection[] = [
  {
    key: 'gst_certificate',
    label: 'GST Certificate',
    description: 'Upload your valid GST registration certificate',
  },
  {
    key: 'pan_card',
    label: 'PAN Card',
    description: 'Upload a copy of your PAN card',
  },
  {
    key: 'bank_details',
    label: 'Bank Details',
    description: 'Upload cancelled cheque or bank verification letter',
  },
  {
    key: 'certifications',
    label: 'Certifications',
    description: 'Upload ISO, quality, or other relevant certifications',
  },
];

type DocStatus = 'Verified' | 'Pending' | 'Not Uploaded';

const STATUS_CONFIG: Record<DocStatus, { style: string; icon: React.ElementType }> = {
  Verified: { style: 'bg-green-100 text-green-700', icon: CheckCircle },
  Pending: { style: 'bg-amber-100 text-amber-700', icon: Clock },
  'Not Uploaded': { style: 'bg-gray-100 text-gray-500', icon: AlertCircle },
};

const VendorDocuments: React.FC = () => {
  const { user } = useAuthStore();
  const vendorId = String(user?.vendor_id ?? user?.id ?? '');

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const res = await getAttachments('vendor', vendorId);
      const data = res.data;
      setAttachments(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const getDocForSection = (sectionKey: string): Attachment | undefined => {
    return attachments.find(
      (a) => a.document_type === sectionKey || a.source_type === sectionKey,
    );
  };

  const getDocStatus = (doc: Attachment | undefined): DocStatus => {
    if (!doc) return 'Not Uploaded';
    if (doc.status === 'verified' || doc.status === 'Verified') return 'Verified';
    return 'Pending';
  };

  const handleUpload = async (sectionKey: string, file: File) => {
    setUploading(sectionKey);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_type', 'vendor_document');
      formData.append('document_type', sectionKey);
      formData.append('vendor_id', vendorId);

      await uploadAttachment(formData);
      toast.success('Document uploaded successfully');
      fetchDocuments();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to upload document');
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = (sectionKey: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error('File size must be under 10 MB');
          return;
        }
        handleUpload(sectionKey, file);
      }
    };
    input.click();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: DocStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.style}`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Vendor Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage your compliance documents</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Documents</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage your compliance documents</p>
      </div>

      {/* Document Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DOCUMENT_SECTIONS.map((section) => {
          const doc = getDocForSection(section.key);
          const status = getDocStatus(doc);
          const isCurrentlyUploading = uploading === section.key;

          return (
            <div
              key={section.key}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg mt-0.5">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{section.label}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>
                  </div>
                </div>
                {renderStatusBadge(status)}
              </div>

              {/* Card Body */}
              <div className="px-5 pb-5">
                {doc ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <File className="w-8 h-8 text-gray-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                      {doc.uploaded_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Uploaded on {formatDate(doc.uploaded_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p className="text-sm text-gray-400">No file uploaded yet</p>
                  </div>
                )}

                {/* Upload Button */}
                <button
                  onClick={() => handleFileSelect(section.key)}
                  disabled={isCurrentlyUploading}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCurrentlyUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {doc ? 'Replace File' : 'Upload File'}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Document Verification</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Uploaded documents will be reviewed and verified by the procurement team. You will be
            notified once verification is complete. Accepted formats: PDF, PNG, JPG, DOC, DOCX (max
            10 MB).
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorDocuments;
