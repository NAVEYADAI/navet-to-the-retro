import { useCallback, useEffect, useState } from 'react';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { fetchOnboardingStatus, postRestoreChecklist } from '../onboarding-api';
import { subscribeOnboardingChanged, notifyOnboardingChanged } from '../onboarding-changed-signal';

/**
 * Feature 21 §21.0 #13 — the settings "התחלה מהירה" card: the permanent way back to the starter
 * checklist after it was hidden. Reads the same status endpoint (mount-only, plus the shared
 * onboarding-changed signal so a dismiss on the dashboard is reflected here) and can restore it.
 */
export function useQuickStart(token: string | null | undefined) {
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const status = await fetchOnboardingStatus(token);
      setDismissed(status.checklistDismissed);
      setComplete(status.checklistComplete);
      setLoaded(true);
    } catch {
      // A nudge, not content: if status can't load the card just stays hidden.
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeOnboardingChanged(() => { void load(); }), [load]);

  const restore = useCallback(async () => {
    if (!token) return;
    setError(null);
    setRestoring(true);
    try {
      await postRestoreChecklist(token);
      trackEvent('onboarding_checklist_restored');
      setDismissed(false);
      notifyOnboardingChanged();
    } catch {
      setError(Strings.onboarding.quickStartRestoreError);
    } finally {
      setRestoring(false);
    }
  }, [token]);

  return { loaded, dismissed, complete, restoring, error, restore };
}
