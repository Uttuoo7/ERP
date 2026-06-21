import React, { useEffect } from 'react';
import { EnterpriseContextProvider } from './EnterpriseContextProvider';
import { EnterpriseShell } from './EnterpriseShell';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';

export function MainLayout() {
  const { user } = useAuthStore();
  const { connect, disconnect } = useWebSocketStore();

  // Initialize unified websocket streams
  useEffect(() => {
    if (user?.id) {
      connect(user.id);
    }
    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return (
    <EnterpriseContextProvider>
      <EnterpriseShell />
    </EnterpriseContextProvider>
  );
}
