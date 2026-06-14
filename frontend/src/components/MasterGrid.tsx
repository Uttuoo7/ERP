import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Download, Upload, Edit, Trash2, X, AlertTriangle, Check, Loader2, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getMasterList, createMasterItem, updateMasterItem, deleteMasterItem, bulkImportMaster, exportMaster, exportMasterTemplate 
} from "../api";
import { useTableDensityStore } from '../store/tableDensityStore';
import { FilterToolbar } from './common/FilterToolbar';
import { TableSkeleton } from './common/TableSkeleton';
import { EmptyState } from './common/EmptyState';

export interface ColumnDefinition {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'date' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  searchable?: boolean;
}

interface MasterGridProps {
  entity: string;
  entityLabel: string;
  columns: ColumnDefinition[];
  searchPlaceholder?: string;
}

const MasterGrid: React.FC<MasterGridProps> = ({
  entity,
  entityLabel,
  columns,
  searchPlaceholder = "Search records..."
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Bulk import states
  const [importing, setImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Global Density
  const { density } = useTableDensityStore();
  const cellPadding = density === 'compact' ? 'px-4 py-2 text-[13px]' : 'px-6 py-4 text-sm';
  const headerPadding = density === 'compact' ? 'px-4 py-3' : 'px-6 py-4';

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        search: search || undefined,
        is_active: isActiveFilter !== null ? isActiveFilter : undefined
      };
      const res = await getMasterList(entity, params);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [entity, page, isActiveFilter]);

  // Debounced search trigger
  useEffect(() => {
    const delay = setTimeout(() => {
      setPage(1);
      fetchRecords();
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    const initialData: Record<string, any> = {};
    columns.forEach(col => {
      if (col.type === 'boolean') {
        initialData[col.key] = true;
      } else {
        initialData[col.key] = "";
      }
    });
    setFormData(initialData);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    const editData: Record<string, any> = {};
    columns.forEach(col => {
      editData[col.key] = item[col.key] !== null && item[col.key] !== undefined ? item[col.key] : "";
    });
    setFormData(editData);
    setIsModalOpen(true);
  };

  const handleInputChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    for (const col of columns) {
      if (col.required && !formData[col.key] && formData[col.key] !== false) {
        toast.error(`${col.label} is required.`);
        return;
      }
    }

    try {
      if (editingItem) {
        await updateMasterItem(entity, editingItem.id, formData);
        toast.success(`${entityLabel} updated successfully!`);
      } else {
        await createMasterItem(entity, formData);
        toast.success(`${entityLabel} created successfully!`);
      }
      setIsModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      // API error handled by Axios interceptor
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${entityLabel}?`)) return;
    try {
      await deleteMasterItem(entity, id);
      toast.success(`${entityLabel} soft-deleted successfully.`);
      fetchRecords();
    } catch (err) {}
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await bulkImportMaster(entity, file);
      toast.success(`Bulk import completed successfully.`);
      fetchRecords();
      setIsImportModalOpen(false);
    } catch (err) {
      // Details are printed in toast by axios interceptor
    } finally {
      setImporting(false);
      e.target.value = ""; // Reset file input
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportMaster(entity);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityLabel.toLowerCase().replace(" ", "_")}_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to export master data CSV.");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await exportMasterTemplate(entity);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityLabel.toLowerCase().replace(" ", "_")}_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to download template.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Bulk Operations */}
      <FilterToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        filters={
          <select
            value={isActiveFilter === null ? "" : String(isActiveFilter)}
            onChange={(e) => {
              const val = e.target.value;
              setIsActiveFilter(val === "" ? null : val === "true");
            }}
            className="bg-transparent border-none outline-none text-slate-700 text-xs font-medium cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        }
        actions={
          <>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-erp-border rounded-erp hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-erp-border rounded-erp hover:bg-slate-50 transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button 
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-erp-primary hover:bg-erp-primary/90 rounded-erp transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add {entityLabel}
            </button>
          </>
        }
      />

      {/* Main Table Grid */}
      <div className="bg-white rounded-erp border border-erp-border shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton columns={columns.length + 2} />
        ) : items.length === 0 ? (
          <EmptyState 
            icon={<AlertTriangle className="w-8 h-8" />} 
            title="No master data found" 
            description="We couldn't find any records matching your filters. Try adding a new record or running a bulk CSV import." 
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-erp-border shadow-sm">
                <tr className="bg-slate-50/50">
                  {columns.map(col => (
                    <th key={col.key} className={`${headerPadding} text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>
                      {col.label}
                    </th>
                  ))}
                  <th className={`${headerPadding} text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>Status</th>
                  <th className={`${headerPadding} text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-erp-border">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {columns.map(col => (
                      <td key={col.key} className={`${cellPadding} font-medium text-slate-700`}>
                        {col.type === 'boolean' ? (
                          item[col.key] ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                              <Check className="w-3.5 h-3.5" /> True
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                              False
                            </span>
                          )
                        ) : col.type === 'date' ? (
                          item[col.key] ? new Date(item[col.key]).toLocaleDateString() : '-'
                        ) : (
                          item[col.key] || '-'
                        )}
                      </td>
                    ))}
                    <td className={cellPadding}>
                      {item.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`${cellPadding} text-right`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button 
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-sm">
              <span className="text-slate-500 font-medium">
                Showing {items.length} of {total} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition-all text-xs"
                >
                  Previous
                </button>
                <button
                  disabled={page * limit >= total}
                  onClick={() => setPage(page + 1)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition-all text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reusable Dynamically Built Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? `Edit ${entityLabel}` : `Add New ${entityLabel}`}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {columns.map(col => (
                  <div key={col.key} className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {col.label} {col.required && <span className="text-rose-500">*</span>}
                    </label>
                    {col.type === 'select' ? (
                      <select
                        value={formData[col.key] || ""}
                        onChange={(e) => handleInputChange(col.key, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        required={col.required}
                      >
                        <option value="">Select option</option>
                        {col.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : col.type === 'boolean' ? (
                      <label className="inline-flex items-center gap-2 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={formData[col.key] || false}
                          onChange={(e) => handleInputChange(col.key, e.target.checked)}
                          className="w-4.5 h-4.5 rounded text-blue-600 border-slate-300 focus:ring-blue-100 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-700">Active</span>
                      </label>
                    ) : col.type === 'date' ? (
                      <input
                        type="date"
                        value={formData[col.key] ? formData[col.key].split("T")[0] : ""}
                        onChange={(e) => handleInputChange(col.key, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        required={col.required}
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[col.key] || ""}
                        onChange={(e) => handleInputChange(col.key, e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        required={col.required}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
                >
                  {editingItem ? "Save Changes" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Import Data</h2>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col items-start gap-2">
                <h3 className="text-sm font-semibold text-blue-900">Need a template?</h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Download our example CSV template to see the required format and fields. This ensures your data is consistent and imports correctly without errors.
                </p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="mt-2 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Example Template
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Upload CSV File</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                    <p className="text-sm text-slate-500 font-medium">
                      {importing ? "Importing..." : "Click or drag to upload"}
                    </p>
                  </div>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleBulkImport} 
                    className="hidden" 
                    disabled={importing}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterGrid;
