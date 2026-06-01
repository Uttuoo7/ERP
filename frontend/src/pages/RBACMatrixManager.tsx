import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Users, AlertTriangle, CheckCircle, Loader2, Sparkles, Database, ShieldAlert, ArrowRight, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getRBACMatrix, getRBACUsers, assignUserRole, getSecurityAuditLogs } from "../api";

const RBACMatrixManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit'>('users');

  // States
  const [users, setUsers] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [submittingId, setSubmittingId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await getRBACUsers();
        setUsers(res.data);
      } else if (activeTab === 'matrix') {
        const res = await getRBACMatrix();
        setMatrix(res.data);
      } else if (activeTab === 'audit') {
        const res = await getSecurityAuditLogs();
        setAuditLogs(res.data);
      }
    } catch (err) {
      toast.error("Access Denied. You do not possess administrator RBAC permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSubmittingId(userId);
    try {
      await assignUserRole({ user_id: userId, role: newRole });
      toast.success("User role modified successfully!");
      fetchData();
    } catch (err) {
      // Handled
    } finally {
      setSubmittingId("");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen text-xs font-semibold text-slate-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Enterprise Role Management Console</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Configure user role assignments, audit dynamic action matrices, and track failed access log traces</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" /> User Role Assignment
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'matrix' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Key className="w-4 h-4" /> Dynamic Permission Matrix
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Failed Access & Security Logs
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Consolidating security parameters...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tab 1: User assignment list */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-4.5 h-4.5 text-blue-600" /> Active Platform Users
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      <th className="px-4 py-3.5">User Profile</th>
                      <th className="px-4 py-3.5">Email Identity</th>
                      <th className="px-4 py-3.5 text-center">Security Role</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-right">Assign Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 bg-white">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/20">
                        <td className="px-4 py-4 font-black text-slate-900">{u.username}</td>
                        <td className="px-4 py-4 text-slate-500">{u.email}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[9.5px] font-black border bg-blue-50 text-blue-700 border-blue-100">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black border ${
                            u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {u.is_active ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={u.role}
                              disabled={submittingId === u.id}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white text-slate-800 font-bold"
                            >
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="PROCUREMENT_MANAGER">PROCUREMENT_MANAGER</option>
                              <option value="BUYER">BUYER</option>
                              <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                              <option value="FINANCE">FINANCE</option>
                              <option value="WAREHOUSE_MANAGER">WAREHOUSE_MANAGER</option>
                              <option value="WAREHOUSE">WAREHOUSE</option>
                              <option value="EMPLOYEE">EMPLOYEE</option>
                              <option value="AUDITOR">AUDITOR</option>
                              <option value="VENDOR">VENDOR</option>
                            </select>
                            {submittingId === u.id && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Permission matrix map */}
          {activeTab === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <Database className="w-4.5 h-4.5 text-blue-600" /> Dynamic Role Permission Mapping
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(matrix).map(([roleName, perms]) => (
                  <div key={roleName} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50 space-y-3">
                    <span className="font-extrabold text-slate-900 block text-[11px] uppercase tracking-wider">{roleName} permissions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.length === 0 ? (
                        <span className="text-[10px] text-slate-400">No explicit permissions assigned</span>
                      ) : (
                        perms.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-650 rounded text-[9.5px] font-bold">
                            {p}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Security audit logs */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert className="w-4.5 h-4.5 text-rose-600" /> Security Intrusion & Action Audit Logs
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                      <th className="px-4 py-3.5">Log Timestamp</th>
                      <th className="px-4 py-3.5">Security action</th>
                      <th className="px-4 py-3.5">Action Details</th>
                      <th className="px-4 py-3.5 text-right">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 bg-white">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400">No failed access attempts or mutations recorded.</td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/20">
                          <td className="px-4 py-4 text-slate-400 font-semibold">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black border ${
                              log.action === 'ACCESS_BLOCKED' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-650 max-w-md break-words">{log.details}</td>
                          <td className="px-4 py-4 text-right text-slate-400">{log.ip_address || "127.0.0.1"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RBACMatrixManager;
