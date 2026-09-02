import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { getAuthHeaders } from '@/api/client';

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
    // Wake-up ping: both frontend and backend scale to zero on Fly.io (min_machines_running=0,
    // auto_stop_machines='suspend' in fly.toml). A cold backend's first real request can fail
    // outright rather than just being slow, so fire this harmless, response-ignored request the
    // instant the app boots — it gives the machine (and its DB connection, since `GET /` also
    // runs a query) a head start before the user finishes typing a login, or before the
    // /auth/me check below runs. Runs in parallel with loadSession(), not awaited by it.
    axios.get(getBackendUrl()).catch(() => {});

    const RETRY_DELAY_MS = 3000;
    const MAX_RETRIES = 2;

    const loadSession = async (attempt = 0) => {
      try {
        const savedToken = await storage.getItem('userToken');
        if (!savedToken) {
          setLoading(false);
          return;
        }
        const response = await axios.get(`${getBackendUrl()}/auth/me`, getAuthHeaders(savedToken));
        setToken(savedToken);
        setUser(response.data);
        setLoading(false);
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          // The token itself was rejected — it's genuinely invalid, not a cold-start hiccup.
          await storage.removeItem('userToken');
          console.warn('Session expired, please log in again');
          setLoading(false);
          return;
        }

        // Any other failure (no response, timeout, 5xx) is more likely the Fly.io backend
        // still cold-starting than a real auth problem — retry instead of wiping a perfectly
        // valid saved token just because of bad timing.
        console.error('Failed to restore session (will retry if attempts remain)', e);
        if (attempt < MAX_RETRIES) {
          setTimeout(() => loadSession(attempt + 1), RETRY_DELAY_MS);
        } else {
          setLoading(false);
        }
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
