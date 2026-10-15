import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Modal } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { errorMessage } from '../focus-points-logic';
import { ActionButtonNative, LabeledInputNative, PillPickerNative, TextNative } from './native-parts';
import type { FocusPointKind, PointFormValues } from '../types';

const S = Strings.focusPoints;
const SCORES = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

interface PointFormNativeProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: PointFormValues;
  fromProposal?: boolean;
  onSubmit: (values: PointFormValues) => Promise<void>;
  onClose: () => void;
}

export function PointFormNative({ open, mode, initial, fromProposal, onSubmit, onClose }: PointFormNativeProps) {
  const t = useTheme();
  const [kind, setKind] = useState<FocusPointKind>(initial.kind);
  const [text, setText] = useState(initial.text);
  const [score, setScore] = useState(String(initial.initialScore));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Closing or cancelling without saving = an abandoned form (a funnel step worth seeing).
  const abandon = () => { trackEvent('focus_point_form_abandoned', { mode: mode }); onClose(); };

  useEffect(() => {
    if (!open) return;
    setKind(initial.kind);
    setText(initial.text);
    setScore(String(initial.initialScore));
    setError(null);
  }, [open, initial]);

  const submit = async () => {
    if (!text.trim()) {
      trackEvent('focus_point_form_validation_failed', { mode: mode });
      setError(S.textRequiredError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ kind, text: text.trim(), initialScore: Number(score) });
    } catch (err: any) {
      trackEvent('focus_point_form_submit_failed', { mode: mode, status: err?.response?.status ?? 0 });
      setError(errorMessage(err, S.saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={abandon} title={mode === 'create' ? S.formCreateTitle : S.formEditTitle} subtitle={fromProposal ? S.formFromProposalSubtitle : undefined} closeLabel={S.closeLabel}>
      {error ? <TextNative kind="caption" color={t.color.status.danger.fg}>{error}</TextNative> : null}
      {mode === 'create' ? (
        <PillPickerNative label={S.kindLabel} value={kind} onChange={(v) => setKind(v as FocusPointKind)} options={[{ value: 'IMPROVE', label: S.kindImprove }, { value: 'KEEP', label: S.kindKeep }]} />
      ) : null}
      <LabeledInputNative label={`${S.textLabel} *`} value={text} onChangeText={setText} multiline placeholder={S.textPlaceholder} />
      {mode === 'create' && kind === 'IMPROVE' ? (
        <View style={{ gap: t.space[1] }}>
          <PillPickerNative label={S.initialScoreLabel} value={score} onChange={setScore} options={SCORES} />
          <TextNative kind="caption" color={t.color.textMuted}>{S.initialScoreHint}</TextNative>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
        <View style={{ flex: 1 }}><ActionButtonNative variant="primary" label={mode === 'create' ? S.createButton : S.saveButton} onPress={submit} loading={isSaving} /></View>
        <View style={{ flex: 1 }}><ActionButtonNative label={S.cancelButton} onPress={abandon} disabled={isSaving} /></View>
      </View>
    </Modal>
  );
}
