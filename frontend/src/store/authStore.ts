import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: true,
  login: (token, user) => {
    localStorage.setItem('token', token);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },
  setUser: (user) => set({ user, isAuthenticated: true }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
