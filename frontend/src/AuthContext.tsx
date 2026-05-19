import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  role: string | null;
  email: string | null;
  login: (token: string, refreshToken: string, role: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('refresh_token'));
  const [role, setRole] = useState<string | null>(localStorage.getItem('role'));
  const [email, setEmail] = useState<string | null>(localStorage.getItem('email'));

  const login = (newToken: string, newRefreshToken: string, newRole: string, newEmail: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('refresh_token', newRefreshToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('email', newEmail);
    setToken(newToken);
    setRefreshToken(newRefreshToken);
    setRole(newRole);
    setEmail(newEmail);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    setToken(null);
    setRefreshToken(null);
    setRole(null);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ token, refreshToken, role, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
