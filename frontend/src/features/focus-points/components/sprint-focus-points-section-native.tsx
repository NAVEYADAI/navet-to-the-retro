import React, { useState } from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { errorMessage } from '../focus-points-logic';
import { ActionButtonNative, CardNative, LabeledInputNative, PillPickerNative, TextNative } from './native-parts';
import type { useSprintFocusPoints } from '../hooks/use-sprint-focus-points';

const S = Strings.focusPoints;
const SCORES = ['1', '2', '3', '4', '5'].map((v, i) => ({ value: v, label: i === 0 || i === 4 ? S.boardScoreLabels[i] : v }));
type Focus = ReturnType<typeof useSprintFocusPoints>;

function RatingRowNative({ point, focus, canRate }: { point: NonNullable<Focus['view']>['points'][number]; focus: Focus; canRate: boolean }) {
  const t = useTheme();
  const [score, setScore] = useState(point.myRating ? String(point.myRating.score) : '');
  const [reason, setReason] = useState(point.myRating?.reason ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(point.myRating ? 'saved' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await focus.rate(point.id, Number(score), reason);
      setState('saved');
    } catch (err) {
      setError(errorMessage(err, S.boardRateError));
      setState('error');
    }
  };

  return (
    <View style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
      <TextNative bold>{point.text}</TextNative>
      {canRate ? (
        <>
          <PillPickerNative label={S.boardRatePrompt} value={score} onChange={(v) => { setScore(v); setState('idle'); }} options={SCORES} />
          <LabeledInputNative label={S.boardReasonLabel} value={reason} onChangeText={(v) => { setReason(v); setState('idle'); }} placeholder={S.boardReasonPlaceholder} />
          {error ? <TextNative kind="caption" color={t.color.status.danger.fg}>{error}</TextNative> : null}
          <ActionButtonNative label={S.boardSaveRating} disabled={!score} loading={state === 'saving'} onPress={save} />
          {state === 'saved' ? <TextNative kind="caption" color={t.color.status.success.fg}>{S.boardRateSaved}</TextNative> : null}
        </>
      ) : null}
    </View>
  );
}

export function SprintFocusPointsSectionNative({ focus }: { focus: Focus }) {
  const { view } = focus;
  if (!view || focus.loadError || view.points.length === 0) return null;
  const canRate = view.window === 'OPEN';
  return (
    <CardNative>
      <TextNative kind="title">{S.boardTitle}</TextNative>
      {view.window === 'NOT_OPEN' ? <TextNative kind="caption">{S.boardWindowNotOpen}</TextNative> : null}
      {view.window === 'CLOSED' ? <TextNative kind="caption">{S.boardWindowClosed}</TextNative> : null}
      {canRate ? <TextNative kind="caption">{S.boardAnonymousNote}</TextNative> : null}
      {view.points.map((p) => <RatingRowNative key={p.id} point={p} focus={focus} canRate={canRate} />)}
    </CardNative>
  );
}
