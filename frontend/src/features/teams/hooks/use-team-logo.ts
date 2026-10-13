import { useCallback, useState } from 'react';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { removeTeamLogo, updateTeamAccent, uploadTeamLogo } from '@/features/teams/team-logo-api';
import { teamLogoPath } from '@/features/teams/team-logo-urls';
import { loadStoredLogoHues, pickLogoAsset, prepareLogo, type PreparedLogo } from '@/features/teams/team-logo-pipeline';

interface Params {
  teamId: number;
  token: string;
  logoUpdatedAt: string | null | undefined;
  accentHue: number | null | undefined;
  /** רענון רשימת הצוותים אחרי שינוי (אותו callback של `onTeamDetailsUpdated`). */
  onChanged: () => void;
}

type Mode = 'idle' | 'upload' | 'recolor';

const errorMessage = (err: any, fallback: string): string => err?.response?.data?.message || fallback;

/**
 * כל הלוגיקה של סעיף "לוגו הצוות" בהגדרות הצוות (פיצ'ר 19) — משותפת ל-web ול-native; רק הסעיפים
 * התצוגתיים שונים. מצבים: idle → upload (בחירה + התאמה + צבע + שמירה) / recolor (שינוי צבע של לוגו שמור).
 */
export function useTeamLogo({ teamId, token, logoUpdatedAt, accentHue, onChanged }: Params) {
  const [mode, setMode] = useState<Mode>('idle');
  const [prepared, setPrepared] = useState<PreparedLogo | null>(null);
  const [recolorHues, setRecolorHues] = useState<number[]>([]);
  const [selectedHue, setSelectedHue] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  const close = useCallback(() => {
    setMode('idle');
    setPrepared(null);
    setRecolorHues([]);
    setError(null);
  }, []);

  const startUpload = useCallback(async () => {
    setError(null);
    trackEvent('team_logo_pick_started', { replacing: !!logoUpdatedAt });
    try {
      const asset = await pickLogoAsset();
      if (!asset) return;
      setIsBusy(true);
      const result = await prepareLogo(asset);
      setPrepared(result);
      setSelectedHue(result.hues[0] ?? null);
      setMode('upload');
    } catch {
      setError(Strings.teamLogo.pickingError);
    } finally {
      setIsBusy(false);
    }
  }, [logoUpdatedAt]);

  const save = useCallback(async () => {
    if (!prepared) return;
    setError(null);
    setIsBusy(true);
    try {
      await uploadTeamLogo(teamId, token, { uri: prepared.uri, accentHue: selectedHue });
      trackEvent('team_logo_saved', { has_color: selectedHue !== null, replaced: !!logoUpdatedAt, color_candidate_index: selectedHue === null ? -1 : prepared.hues.indexOf(selectedHue) });
      close();
      onChanged();
    } catch (err) {
      setError(errorMessage(err, Strings.teamLogo.uploadError));
    } finally {
      setIsBusy(false);
    }
  }, [prepared, teamId, token, selectedHue, logoUpdatedAt, close, onChanged]);

  const cancel = useCallback(() => {
    trackEvent('team_logo_dialog_cancelled', { step: mode });
    close();
  }, [mode, close]);

  const startRecolor = useCallback(async () => {
    setError(null);
    trackEvent('team_logo_color_change_started');
    setIsBusy(true);
    try {
      const hues = await loadStoredLogoHues(`${getBackendUrl()}${teamLogoPath(teamId, logoUpdatedAt)}`, { Authorization: `Bearer ${token}` });
      // הצבע הנוכחי תמיד ברשימה, גם אם הוא כבר לא אחד מהגוונים שמזוהים בלוגו.
      const withCurrent = accentHue !== null && accentHue !== undefined && !hues.includes(accentHue) ? [accentHue, ...hues].slice(0, 3) : hues;
      setRecolorHues(withCurrent);
      setSelectedHue(accentHue ?? null);
      setMode('recolor');
    } catch {
      setError(Strings.teamLogo.accentError);
    } finally {
      setIsBusy(false);
    }
  }, [teamId, token, logoUpdatedAt, accentHue]);

  const saveRecolor = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      await updateTeamAccent(teamId, token, selectedHue);
      trackEvent('team_logo_color_changed', { has_color: selectedHue !== null });
      close();
      onChanged();
    } catch (err) {
      setError(errorMessage(err, Strings.teamLogo.accentError));
    } finally {
      setIsBusy(false);
    }
  }, [teamId, token, selectedHue, close, onChanged]);

  const askRemove = useCallback(() => {
    setError(null);
    setIsConfirmingRemove(true);
  }, []);

  const cancelRemove = useCallback(() => setIsConfirmingRemove(false), []);

  const confirmRemove = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      await removeTeamLogo(teamId, token);
      trackEvent('team_logo_removed');
      setIsConfirmingRemove(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, Strings.teamLogo.removeError));
      setIsConfirmingRemove(false);
    } finally {
      setIsBusy(false);
    }
  }, [teamId, token, onChanged]);

  const selectHue = useCallback((hue: number | null) => {
    trackEvent('team_logo_color_selected', { none: hue === null });
    setSelectedHue(hue);
  }, []);

  return {
    mode,
    prepared,
    hueOptions: mode === 'recolor' ? recolorHues : prepared?.hues ?? [],
    selectedHue,
    selectHue,
    isBusy,
    error,
    isConfirmingRemove,
    startUpload,
    save,
    cancel,
    startRecolor,
    saveRecolor,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
}

export type TeamLogoController = ReturnType<typeof useTeamLogo>;
