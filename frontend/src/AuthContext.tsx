import React, { createContext, useContext } from 'react';
import { useAuthStore } from "./store/authStore";

const AuthContext = createContext<any>(null);

const decodeToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decodeFn = typeof window !== 'undefined' ? window.atob : (str: string) => Buffer.from(str, 'base64').toString('binary');
    const jsonPayload = decodeURIComponent(
      decodeFn(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthStore();
  
  const login = (token: string, refreshToken: string, role: string, email: string) => {
    localStorage.setItem('refresh_token', refreshToken);
    const decoded = decodeToken(token);
    const userId = decoded?.sub || '1';
    auth.login(token, { id: userId, username: email.split('@')[0], email, role });
  };
  
  const logout = () => {
    auth.logout();
  };

  const value = {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a fallback that uses authStore directly if provider is not present
    const auth = useAuthStore.getState();
    const login = (token: string, refreshToken: string, role: string, email: string) => {
      localStorage.setItem('refresh_token', refreshToken);
      const decoded = decodeToken(token);
      const userId = decoded?.sub || '1';
      auth.login(token, { id: userId, username: email.split('@')[0], email, role });
    };
    return {
      user: auth.user,
      isAuthenticated: auth.isAuthenticated,
      login,
      logout: auth.logout,
    };
  }
  return context;
};
