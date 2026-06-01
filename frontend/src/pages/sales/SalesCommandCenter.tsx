import React, { useState } from 'react';
import { ShoppingCart, FileText, CheckCircle, Clock, Search, ExternalLink } from 'lucide-react';
import api from "../../api";

export function SalesCommandCenter() {
  const [activeTab, setActiveTab] = useState<'QUOTATIONS' | 'ORDERS'>('ORDERS');
  
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-600" />
            Sales Command Center
          </h1>
          <p className="text-slate-500 mt-1">Manage enterprise quotations, orders, and inventory reservations.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm">
            + New Quotation
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm">
            + Create Sales Order
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'ORDERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('ORDERS')}
        >
          Sales Orders
        </button>
        <button 
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${activeTab === 'QUOTATIONS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('QUOTATIONS')}
        >
          Quotations
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[600px] flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="relative w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 rounded-lg shadow-sm" />
          </div>
          <div className="flex gap-2">
            <select className="border-slate-200 rounded-lg shadow-sm text-sm p-2">
              <option>All Statuses</option>
              <option>Pending Approval</option>
              <option>Approved</option>
            </select>
          </div>
        </div>
        
        <div className="flex-1 p-8 text-center text-slate-500 flex flex-col items-center justify-center">
          <FileText className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="font-bold text-slate-700 text-lg">No {activeTab.toLowerCase()} found</h3>
          <p className="text-sm mt-1">Create a new record to get started with the enterprise sales workflow.</p>
        </div>
      </div>
    </div>
  );
}
