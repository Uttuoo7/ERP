import React, { createContext, useContext } from 'react';
import { useAuthStore } from "./store/authStore";

const AuthContext = createContext<any>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthStore();
  
  const login = (token: string, refreshToken: string, role: string, email: string) => {
    auth.login(token, { id: 1, username: email.split('@')[0], email, role });
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
      auth.login(token, { id: 1, username: email.split('@')[0], email, role });
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
