import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getEnterpriseContext } from '../../api';

export interface EnterpriseContextType {
  user: { name?: string; email: string; role: string } | null;
  company: string;
  businessUnit: string;
  warehouse: string;
  plant: string;
  financialYear: string;
  database: string;
  environment: 'Development' | 'Staging' | 'Production';
  apiStatus: 'Healthy' | 'Degraded' | 'Offline';
  isOnline: boolean;
  language: string;
  currency: string;
  setCompanyContext: (context: Partial<Omit<EnterpriseContextType, 'user' | 'isOnline' | 'setCompanyContext'>>) => void;
}

const EnterpriseContext = createContext<EnterpriseContextType | undefined>(undefined);

export function EnterpriseContextProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore(state => state.user);

  // Initialize company-level states with default dynamic contexts
  const [context, setContext] = useState({
    company: 'Retrieving Company...',
    businessUnit: 'Loading Unit...',
    warehouse: 'Loading Warehouse...',
    plant: 'Loading Plant...',
    financialYear: '2026-27',
    database: 'SQLite (Production)',
    environment: 'Development' as const,
    apiStatus: 'Healthy' as const,
    language: 'English (US)',
    currency: 'INR (₹)',
  });

  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  // Fetch runtime context from session dynamically
  useEffect(() => {
    if (currentUser) {
      getEnterpriseContext()
        .then(res => {
          if (res && res.data) {
            setContext(res.data);
          }
        })
        .catch(err => {
          console.error('Failed to load runtime enterprise context:', err);
        });
    }
  }, [currentUser]);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setCompanyContext = (newContext: Partial<typeof context>) => {
    setContext(prev => ({ ...prev, ...newContext }));
  };

  const userObject = currentUser ? {
    name: currentUser.email.split('@')[0],
    email: currentUser.email,
    role: currentUser.role
  } : null;

  return (
    <EnterpriseContext.Provider
      value={{
        user: userObject,
        ...context,
        isOnline,
        setCompanyContext,
      }}
    >
      {children}
    </EnterpriseContext.Provider>
  );
}

export function useEnterpriseContext() {
  const contextValue = useContext(EnterpriseContext);
  if (!contextValue) {
    throw new Error('useEnterpriseContext must be used within an EnterpriseContextProvider');
  }
  return contextValue;
}
