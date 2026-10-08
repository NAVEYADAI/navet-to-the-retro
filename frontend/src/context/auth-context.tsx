import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { getAuthHeaders, apiClient } from '@/api/client';
import { installUnauthorizedInterceptor, setUnauthorizedHandler } from '@/api/unauthorized-interceptor';
import { identifyUser, resetAnalytics } from '@/lib/analytics';
import { sessionStorage as storage } from '@/lib/session-storage';

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
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // BUG-08: an authenticated request that gets a 401 mid-session (expired 12h JWT) clears the
  // session; the auth gate in _layout.tsx then renders the login form. Only reacts when the
  // rejected token is still the current one, so a late 401 from an old token can't log out a
  // user who has just signed in again.
  useEffect(() => {
    setUnauthorizedHandler((rejectedToken) => {
      if (tokenRef.current && rejectedToken === tokenRef.current) {
        void logoutRef.current();
      }
    });
    const uninstall = [
      installUnauthorizedInterceptor(axios),
      installUnauthorizedInterceptor(apiClient),
    ];
    return () => {
      setUnauthorizedHandler(null);
      uninstall.forEach((fn) => fn());
    };
  }, []);

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
        identifyUser(response.data);
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

  // BUG-57: stable identity (only state setters / module-level helpers inside), so effects that
  // list `login` as a dependency (google/callback.tsx) don't re-run on every provider render.
  const login = useCallback(async (newToken: string, newUser: any) => {
    await storage.setItem('userToken', newToken);
    setToken(newToken);
    setUser(newUser);
    identifyUser(newUser);
  }, []);

  const logout = async () => {
    await storage.removeItem('userToken');
    setToken(null);
    setUser(null);
    resetAnalytics();
  };
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

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
