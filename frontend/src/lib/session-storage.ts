import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key/value storage for the auth session token. Web uses localStorage; native uses AsyncStorage
// so the session survives app launches (BUG-30 — it used to be in-memory only, logging the user
// out on every launch). If the persistent store throws (corrupt/unavailable storage) we degrade to
// an in-memory copy so login still works for the current launch instead of failing outright.

const memoryStorage: Record<string, string> = {};

const useWebStorage = (): boolean => Platform.OS === 'web' && typeof window !== 'undefined';

export const sessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (useWebStorage()) {
      return localStorage.getItem(key);
    }
    try {
      const value = await AsyncStorage.getItem(key);
      if (value != null) return value;
    } catch (e) {
      console.warn('Failed to read persisted session', e);
    }
    return memoryStorage[key] ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (useWebStorage()) {
      localStorage.setItem(key, value);
      return;
    }
    memoryStorage[key] = value;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Failed to persist session', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (useWebStorage()) {
      localStorage.removeItem(key);
      return;
    }
    delete memoryStorage[key];
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to clear persisted session', e);
    }
  },
};
