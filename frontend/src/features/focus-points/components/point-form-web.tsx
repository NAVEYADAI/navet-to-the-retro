import React, { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Modal, Segmented } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { errorMessage } from '../focus-points-logic';
import type { FocusPointKind, PointFormValues } from '../types';

const S = Strings.focusPoints;

interface PointFormWebProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: PointFormValues;
  fromProposal?: boolean;
  onSubmit: (values: PointFormValues) => Promise<void>;
  onClose: () => void;
}

const SCORES = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

export function PointFormWeb({ open, mode, initial, fromProposal, onSubmit, onClose }: PointFormWebProps) {
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
    <Modal
      open={open}
      onClose={abandon}
      title={mode === 'create' ? S.formCreateTitle : S.formEditTitle}
      subtitle={fromProposal ? S.formFromProposalSubtitle : undefined}
      closeLabel={S.closeLabel}
    >
      {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
      {mode === 'create' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
          <Box component="span" sx={{ ...t.type.label, color: t.color.textSecondary }}>{S.kindLabel}</Box>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: 'IMPROVE', label: S.kindImprove }, { value: 'KEEP', label: S.kindKeep }]}
          />
        </Box>
      ) : null}
      <Field type="textarea" rows={3} label={S.textLabel} placeholder={S.textPlaceholder} value={text} onChangeText={setText} required />
      {mode === 'create' && kind === 'IMPROVE' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
          <Box component="span" sx={{ ...t.type.label, color: t.color.textSecondary }}>{S.initialScoreLabel}</Box>
          <Segmented value={score} onChange={setScore} options={SCORES} />
          <Box component="span" sx={{ ...t.type.caption, color: t.color.textMuted }}>{S.initialScoreHint}</Box>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px`, justifyContent: 'flex-end' }}>
        <Button variant="primary" onPress={submit} disabled={isSaving} loading={isSaving}>
          {mode === 'create' ? S.createButton : S.saveButton}
        </Button>
        <Button variant="secondary" onPress={abandon} disabled={isSaving}>{S.cancelButton}</Button>
      </Box>
    </Modal>
  );
}
