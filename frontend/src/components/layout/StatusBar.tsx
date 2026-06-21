import React from 'react';
import { useEnterpriseContext } from './EnterpriseContextProvider';
import { useBackgroundJobStore } from '../../store/backgroundJobStore';
import { Database, AlertCircle, RefreshCw, Loader2, Wifi, WifiOff } from 'lucide-react';

export function StatusBar() {
  const {
    user,
    company,
    businessUnit,
    warehouse,
    financialYear,
    database,
    environment,
    apiStatus,
    isOnline,
    language,
    currency
  } = useEnterpriseContext();

  const { jobs } = useBackgroundJobStore();
  const activeJobs = jobs.filter(j => j.status === 'running');

  return (
    <footer className="h-7 bg-slate-800 text-slate-300 border-t border-slate-700 flex items-center justify-between px-4 text-[10px] font-bold select-none shrink-0 font-sans">
      {/* Left side: API & Database Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
          <span className="text-[9px] uppercase tracking-wider">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="flex items-center gap-1 text-slate-400">
          <Database className="w-3 h-3" />
          <span>{database}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="flex items-center gap-1 text-slate-400">
          <span>Env:</span>
          <span className={`px-1 rounded text-[8px] uppercase tracking-wider ${
            environment === 'Production' 
              ? 'bg-rose-900/50 text-rose-300' 
              : environment === 'Staging'
              ? 'bg-amber-900/50 text-amber-300'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {environment}
          </span>
        </div>
      </div>

      {/* Center: Running Background Jobs */}
      <div className="flex-1 flex justify-center px-4">
        {activeJobs.length > 0 ? (
          <div className="flex items-center gap-2 text-blue-400 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>
              {activeJobs[0].name}: {activeJobs[0].progress}% ({activeJobs.length} active)
            </span>
            <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden shrink-0">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${activeJobs[0].progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-slate-500">System Ready</div>
        )}
      </div>

      {/* Right side: Session Context & Localization */}
      <div className="flex items-center gap-4">
        <div className="text-slate-400">
          <span>Company:</span> <span className="text-slate-200">{company}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="text-slate-400">
          <span>WH:</span> <span className="text-slate-200">{warehouse}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="text-slate-400">
          <span>FY:</span> <span className="text-slate-200">{financialYear}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="text-slate-400">
          <span>Lang:</span> <span className="text-slate-200">{language}</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="text-slate-200">
          <span>{currency}</span>
        </div>

        {user && (
          <>
            <span className="text-slate-600">|</span>
            <div className="text-slate-300 flex items-center gap-1 uppercase tracking-wider text-[9px]">
              <span className="text-slate-500 font-normal">User:</span>
              <span>{user.email.split('@')[0]}</span>
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
