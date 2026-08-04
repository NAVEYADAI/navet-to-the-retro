import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

import axios from 'axios';

const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      memoryStorage[key] = value;
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.removeItem(key);
    } else {
      delete memoryStorage[key];
    }
  }
};
const memoryStorage: Record<string, string> = {};

interface AuthContextType {
  token: string | null;
  user: any;
  loading: boolean;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedToken = await storage.getItem('userToken');
        if (savedToken) {
          const backendUrl = Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
            ? 'https://navet-to-retro-backend.fly.dev'
            : 'http://localhost:5005';
            
          const response = await axios.get(`${backendUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          setToken(savedToken);
          setUser(response.data);
        }
      } catch (e) {
        await storage.removeItem('userToken');
        console.error('Failed to restore session', e);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (newToken: string, newUser: any) => {
    await storage.setItem('userToken', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await storage.removeItem('userToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
