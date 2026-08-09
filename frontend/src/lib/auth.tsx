'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  hospitalId: string | null;
  phone?: string;
  hospital?: { id: string; name: string; code: string } | null;
  doctorProfile?: any;
  patient?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const stored = localStorage.getItem('token');
      if (!stored) { setLoading(false); return; }
      setToken(stored);
      const res = await apiGet('/auth/me', { token: stored });
      setUser(res.data);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email: string, password: string) => {
    const res = await apiPost('/auth/login', { email, password });
    const { user: u, token: t } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  const register = async (data: any) => {
    const res = await apiPost('/auth/register', data);
    const { user: u, token: t } = res.data;
    localStorage.setItem('token', t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
