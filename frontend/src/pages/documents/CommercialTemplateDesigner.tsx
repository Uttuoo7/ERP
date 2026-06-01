import React, { useState, useEffect } from 'react';
import { FileText, Save, Plus, Trash2, ShieldCheck, Download, Eye } from 'lucide-react';
import api from "../../api";

export function CommercialTemplateDesigner() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    payment_terms: '',
    freight_terms: '',
    delivery_terms: '',
    warranty_clauses: '',
    insurance_clauses: '',
    penalty_clauses: '',
    validity_clauses: '',
    dispatch_instructions: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/commercial-documents/commercial-templates');
      setTemplates(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    try {
      await api.post('/commercial-documents/commercial-templates', formData);
      setIsCreating(false);
      fetchTemplates();
      setFormData({
        name: '', payment_terms: '', freight_terms: '', delivery_terms: '', warranty_clauses: '',
        insurance_clauses: '', penalty_clauses: '', validity_clauses: '', dispatch_instructions: ''
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            Commercial Template Designer
          </h1>
          <p className="text-slate-500 mt-1">Design and manage enterprise commercial terms for legal document generation.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" /> New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 h-[600px] overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-4 px-2">Saved Templates</h3>
          <div className="space-y-2">
            {templates.map(t => (
              <div 
                key={t.id}
                onClick={() => { setSelectedTemplate(t); setIsCreating(false); }}
                className={`p-3 rounded-xl cursor-pointer border transition-colors ${selectedTemplate?.id === t.id && !isCreating ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{t.payment_terms}</div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-slate-500 text-sm p-2">No templates found.</p>}
          </div>
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          {(isCreating || selectedTemplate) ? (
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">{isCreating ? 'Create New Clause Template' : selectedTemplate.name}</h2>
                {isCreating && (
                  <button onClick={handleSave} className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save Template
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isCreating && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  <input type="text" disabled={!isCreating} value={isCreating ? formData.payment_terms : selectedTemplate.payment_terms} onChange={e => setFormData({...formData, payment_terms: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Freight Terms</label>
                  <input type="text" disabled={!isCreating} value={isCreating ? formData.freight_terms : selectedTemplate.freight_terms} onChange={e => setFormData({...formData, freight_terms: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Terms</label>
                  <input type="text" disabled={!isCreating} value={isCreating ? formData.delivery_terms : selectedTemplate.delivery_terms} onChange={e => setFormData({...formData, delivery_terms: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2" />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Warranty Clauses</label>
                  <textarea rows={3} disabled={!isCreating} value={isCreating ? formData.warranty_clauses : selectedTemplate.warranty_clauses || ''} onChange={e => setFormData({...formData, warranty_clauses: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Penalty / Liquidation Damages Clauses</label>
                  <textarea rows={3} disabled={!isCreating} value={isCreating ? formData.penalty_clauses : selectedTemplate.penalty_clauses || ''} onChange={e => setFormData({...formData, penalty_clauses: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2" />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a template or create a new one to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
