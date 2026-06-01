import React, { useState, useEffect } from 'react';
import { useAuthStore } from "../../store/authStore";
import { Plus, Edit2, Trash2, Search, Settings, Tag, Shield, FolderTree, Activity } from 'lucide-react';
import api from "../../api";

interface Category {
  id: string;
  name: string;
  code: string;
  prefix: string;
  description: string;
  icon: string;
  color: string;
  workflow_definition_id: string;
  is_active: boolean;
}

export function ProcurementCategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/procurement-categories/');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-600" />
            Procurement Categories
          </h1>
          <p className="text-slate-500 mt-1">Manage global procurement classifications, prefixes, and workflow policies.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          New Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="text-slate-500 hover:text-slate-700 font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Category Rules
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Activity className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
            Loading category architecture...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCategories.length > 0 ? filteredCategories.map((category) => (
              <div key={category.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm`} style={{ backgroundColor: category.color || '#4f46e5' }}>
                    <Tag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      {category.name}
                      {!category.is_active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Inactive</span>}
                    </h3>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                        {category.code}
                      </span>
                      <span>Prefix: <span className="font-semibold text-slate-700">{category.prefix}</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {category.workflow_definition_id ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <Shield className="w-4 h-4" />
                      Custom Workflow
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      Standard Workflow
                    </div>
                  )}

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-slate-500">
                <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 mb-1">No Categories Found</h3>
                <p>Get started by creating your first procurement classification.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
