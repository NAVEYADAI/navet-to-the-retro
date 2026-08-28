import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { buildTheme, type AccentScheme, type AppTheme, type Density } from './tokens';

type ModePreference = 'light' | 'dark' | 'system';

type Preferences = { mode: ModePreference; scheme: AccentScheme; density: Density };

const DEFAULTS: Preferences = { mode: 'system', scheme: 'blue', density: 'regular' };
const STORAGE_KEY = 'ui-preferences-v1';

const Ctx = createContext<{
  theme: AppTheme;
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
}>({ theme: buildTheme('light', 'blue'), prefs: DEFAULTS, setPrefs: () => {} });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setPrefsState({ ...DEFAULTS, ...JSON.parse(raw) });
    });
  }, []);

  const setPrefs = (patch: Partial<Preferences>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resolvedMode = prefs.mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : prefs.mode;
  const theme = useMemo(
    () => buildTheme(resolvedMode, prefs.scheme, prefs.density),
    [resolvedMode, prefs.scheme, prefs.density]
  );

  return <Ctx.Provider value={{ theme, prefs, setPrefs }}>{children}</Ctx.Provider>;
}

/** הדרך היחידה שקומפוננטה מקבלת צבע. אין prop `theme` שמועבר ידנית במורד העץ. */
export const useTheme = () => useContext(Ctx).theme;
export const usePreferences = () => {
  const { prefs, setPrefs } = useContext(Ctx);
  return { prefs, setPrefs };
};
