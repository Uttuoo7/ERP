import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Save, ShieldAlert, Settings, Shield, Network, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkflowDefinitions, createWorkflowDefinition } from '../api';

interface Step {
  step_number: number;
  name: string;
  role_required: string;
  condition_expression: string;
  escalation_timeout_hours: number;
}

const WorkflowBuilder: React.FC = () => {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for creating/editing a definition
  const [moduleName, setModuleName] = useState("PURCHASE_ORDER");
  const [configName, setConfigName] = useState("Default Purchase Order Approvals");
  const [steps, setSteps] = useState<Step[]>([
    {
      step_number: 1,
      name: "Procurement Manager Review",
      role_required: "BUYER",
      condition_expression: "amount > 50000",
      escalation_timeout_hours: 24
    }
  ]);

  const fetchDefinitions = async () => {
    setLoading(true);
    try {
      const res = await getWorkflowDefinitions();
      setDefinitions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const handleAddStep = () => {
    const nextStepNum = steps.length + 1;
    setSteps(prev => [
      ...prev,
      {
        step_number: nextStepNum,
        name: `Approval Level ${nextStepNum}`,
        role_required: "FINANCE",
        condition_expression: "",
        escalation_timeout_hours: 48
      }
    ]);
  };

  const handleDeleteStep = (index: number) => {
    const filtered = steps.filter((_, idx) => idx !== index);
    // Recalculate step numbers
    const updated = filtered.map((step, idx) => ({
      ...step,
      step_number: idx + 1
    }));
    setSteps(updated);
  };

  const handleStepFieldChange = (index: number, field: keyof Step, value: any) => {
    const updated = [...steps];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setSteps(updated);
  };

  const moveStep = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === steps.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...steps];
    
    // Swap steps
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Correct step numbers
    const mapped = updated.map((s, idx) => ({
      ...s,
      step_number: idx + 1
    }));

    setSteps(mapped);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (steps.length === 0) {
      toast.error("Please add at least one step step to the approval sequence.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        module: moduleName,
        name: configName,
        is_active: true,
        steps: steps.map(s => ({
          ...s,
          condition_expression: s.condition_expression || null
        }))
      };
      await createWorkflowDefinition(payload);
      toast.success("Workflow definition saved and activated successfully!");
      fetchDefinitions();
    } catch (err) {
      // API error handled by axios interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefinition = (defn: any) => {
    setModuleName(defn.module);
    setConfigName(defn.name);
    
    const sortedSteps = [...defn.steps].sort((a, b) => a.step_number - b.step_number);
    setSteps(sortedSteps.map(s => ({
      step_number: s.step_number,
      name: s.name,
      role_required: s.role_required,
      condition_expression: s.condition_expression || "",
      escalation_timeout_hours: s.escalation_timeout_hours || 24
    })));
    toast.success(`Loaded configuration: ${defn.name}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Network className="w-8 h-8 text-blue-600" />
            Workflow Configurator
          </h1>
          <p className="text-slate-500 mt-1.5">Design, build, and deploy custom dynamic approval routings for target ERP modules</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Definition Builder Form */}
        <form onSubmit={handleSaveConfig} className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              1. Master Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Target ERP Module</label>
                <select
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="PURCHASE_ORDER">Purchase Order</option>
                  <option value="INTERNAL_SALES_ORDER">Internal Sales Requisitions</option>
                  <option value="VENDOR_APPROVAL">Vendor Onboarding</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Workflow Configuration Name</label>
                <input
                  type="text"
                  required
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="e.g. Standard PO Approval Loop"
                />
              </div>
            </div>
          </div>

          {/* Setup steps list */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-400" />
                2. Approval Sequence steps
              </h3>
              
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add approval Level
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-150 relative">
                  <div className="flex flex-col gap-1 mt-1 text-slate-400">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveStep(idx, 'UP')}
                      className="p-1 hover:text-slate-900 hover:bg-white rounded transition-all disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => moveStep(idx, 'DOWN')}
                      className="p-1 hover:text-slate-900 hover:bg-white rounded transition-all disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 text-sm">
                    {/* step index */}
                    <div className="md:col-span-1 flex items-center justify-center">
                      <span className="w-7 h-7 bg-blue-50 text-blue-600 border border-blue-100 font-extrabold rounded-full flex items-center justify-center">
                        {step.step_number}
                      </span>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Step Name</label>
                      <input
                        type="text"
                        required
                        value={step.name}
                        onChange={(e) => handleStepFieldChange(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        placeholder="e.g. Audit Approval"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Required Approver Role</label>
                      <select
                        value={step.role_required}
                        onChange={(e) => handleStepFieldChange(idx, 'role_required', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="BUYER">BUYER</option>
                        <option value="WAREHOUSE">WAREHOUSE</option>
                        <option value="FINANCE">FINANCE</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rule Condition (Optional)</label>
                      <input
                        type="text"
                        value={step.condition_expression}
                        onChange={(e) => handleStepFieldChange(idx, 'condition_expression', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        placeholder="e.g. amount > 50000"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Timeout (Hrs)</label>
                      <input
                        type="number"
                        value={step.escalation_timeout_hours}
                        onChange={(e) => handleStepFieldChange(idx, 'escalation_timeout_hours', parseInt(e.target.value) || 24)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteStep(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all ml-2 mt-2"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save & Activate Loop
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Right Side: Existing Active Definitions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5 h-fit">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-slate-400" />
            <h3 className="text-base font-bold text-slate-900">Active Mapped Loops</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            </div>
          ) : definitions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No workflows currently designed.</p>
          ) : (
            <div className="space-y-3">
              {definitions.map((defn) => (
                <button
                  key={defn.id}
                  onClick={() => handleLoadDefinition(defn)}
                  className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                      {defn.module.replace("_", " ")}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Active
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{defn.name}</h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    {defn.steps.length} levels configured
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
