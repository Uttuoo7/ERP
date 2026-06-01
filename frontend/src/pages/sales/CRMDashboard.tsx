import React, { useState, useEffect } from 'react';
import { Users, Phone, Target, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import api from "../../api";

export function CRMDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  
  useEffect(() => {
    fetchLeads();
  }, []);
  
  const fetchLeads = async () => {
    try {
      const res = await api.get('/crm/leads');
      setLeads(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTATION', 'NEGOTIATION', 'WON', 'LOST'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Target className="w-8 h-8 text-indigo-600" />
            CRM & Lead Pipeline
          </h1>
          <p className="text-slate-500 mt-1">Track enterprise leads from contact to conversion.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          + New Lead
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['Total Leads', 'Pipeline Value', 'Converted this Month', 'Win Rate'].map((m, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-slate-500 text-sm">{m}</h3>
            <div className="text-3xl font-black text-slate-800 mt-2">{i===1 ? "$4.2M" : i===3 ? "68%" : Math.floor(Math.random()*100)}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[600px]">
        {stages.map(stage => (
          <div key={stage} className="bg-slate-50 border border-slate-200 rounded-2xl min-w-[300px] flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
              {stage}
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                {leads.filter(l => l.stage === stage).length}
              </span>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {leads.filter(l => l.stage === stage).map(lead => (
                <div key={lead.id} className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:shadow-md transition cursor-pointer group">
                  <div className="font-bold text-slate-800 text-sm mb-1 group-hover:text-indigo-600">{lead.company_name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                    <Users className="w-3 h-3" /> {lead.contact_person}
                  </div>
                  <div className="flex justify-between items-end mt-3 border-t border-slate-50 pt-2">
                    <div className="text-xs font-bold text-emerald-600">${lead.expected_value.toLocaleString()}</div>
                    {lead.follow_up_date && (
                      <div className="text-xs flex items-center gap-1 text-amber-600 font-medium">
                        <Calendar className="w-3 h-3" /> {new Date(lead.follow_up_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {leads.filter(l => l.stage === stage).length === 0 && (
                <div className="text-center p-4 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Drop lead here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
