import { create } from 'zustand';
import toast from 'react-hot-toast';

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  notif_type: string;
  priority: string;
  created_at: string;
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  connect: (userId: string) => void;
  disconnect: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: (userId: string) => {
    if (get().socket?.readyState === WebSocket.OPEN) return;

    // Deriving dynamic WebSocket URL
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (apiUrl) {
        wsUrl = `${apiUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/api/ws`;
      } else {
        wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;
      }
    }
    const socket = new WebSocket(`${wsUrl}?user_id=${encodeURIComponent(userId)}`);

    socket.onopen = () => {
      console.log('WebSocket Connected');
      set({ isConnected: true });
      
      // Heartbeat ping
      setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      if (event.data === 'pong') return;
      
      try {
        const payload: NotificationPayload = JSON.parse(event.data);
        
        // Trigger Toast globally based on priority
        if (payload.priority === 'HIGH' || payload.priority === 'URGENT' || payload.notif_type === 'CRITICAL') {
          toast.error(`${payload.title}: ${payload.message}`, { duration: 6000, icon: '🔥' });
        } else {
          toast.success(`${payload.title}: ${payload.message}`, { duration: 4000 });
        }

        // We can also dispatch an event so other stores (e.g. notificationStore) can refetch or update their arrays
        window.dispatchEvent(new CustomEvent('NEW_NOTIFICATION', { detail: payload }));
        
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket Disconnected. Reconnecting in 5s...');
      set({ isConnected: false });
      
      // Basic reconnect handling
      setTimeout(() => {
        get().connect(userId);
      }, 5000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
      socket.close();
    };

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  }
}));
