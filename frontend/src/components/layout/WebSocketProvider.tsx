import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from "../../AuthContext"; // assuming we have an AuthContext to get user.id

interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
}

interface WebSocketContextType {
  notifications: NotificationMessage[];
  clearNotification: (id: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  notifications: [],
  clearNotification: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  useEffect(() => {
    if (!user) return;

    // Deriving dynamic WebSocket URL
    let wsUrl = '';
    const userIdEncoded = encodeURIComponent(user.id);
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL.replace(/\/api\/ws\/?$/, `/ws/${userIdEncoded}`).replace(/\/ws\/?$/, `/ws/${userIdEncoded}`);
      if (!wsUrl.includes(`/ws/${userIdEncoded}`)) {
        wsUrl = `${import.meta.env.VITE_WS_URL.replace(/\/+$/, '')}/ws/${userIdEncoded}`;
      }
    } else {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (apiUrl) {
        wsUrl = `${apiUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/${userIdEncoded}`;
      } else {
        wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/${userIdEncoded}`;
      }
    }
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected for user", user.id);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'NEW_NOTIFICATION') {
          setNotifications(prev => [payload.data, ...prev]);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, [user]);

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <WebSocketContext.Provider value={{ notifications, clearNotification }}>
      {children}
    </WebSocketContext.Provider>
  );
}
