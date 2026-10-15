import React, { useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Field, Segmented } from '@/components/ui';
import { errorMessage } from '../focus-points-logic';
import type { useSprintFocusPoints } from '../hooks/use-sprint-focus-points';

const S = Strings.focusPoints;
const SCORES = ['1', '2', '3', '4', '5'].map((v, i) => ({ value: v, label: i === 0 || i === 4 ? S.boardScoreLabels[i] : v }));

type Focus = ReturnType<typeof useSprintFocusPoints>;

function RatingRow({ point, focus, canRate }: { point: NonNullable<Focus['view']>['points'][number]; focus: Focus; canRate: boolean }) {
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
    <Box data-testid="sprint-focus-point" sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, padding: `${t.space[3]}px`, border: `1px solid ${t.color.border}`, borderRadius: `${t.radius.field}px`, backgroundColor: t.color.surface }}>
      <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>{point.text}</Typography>
      {canRate ? (
        <>
          <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{S.boardRatePrompt}</Typography>
          <Segmented value={score} onChange={(v) => { setScore(v); setState('idle'); }} options={SCORES} />
          <Field label={S.boardReasonLabel} placeholder={S.boardReasonPlaceholder} value={reason} onChangeText={(v) => { setReason(v); setState('idle'); }} />
          {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
            <Button variant="secondary" size="sm" disabled={!score || state === 'saving'} loading={state === 'saving'} onPress={save}>{S.boardSaveRating}</Button>
            {state === 'saved' ? <Badge tone="success" icon="check">{S.boardRateSaved}</Badge> : null}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

/** What a team member sees on the retro board: the points chosen for this sprint, and — once the sprint ended — a place to rate them anonymously. */
export function SprintFocusPointsSectionWeb({ focus }: { focus: Focus }) {
  const t = useTheme();
  const { view } = focus;
  if (!view || focus.loadError) return null;
  // Nothing selected and nothing to say: keep the board clean.
  if (view.points.length === 0) return null;
  const canRate = view.window === 'OPEN';

  return (
    <Card>
      <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.boardTitle}</Typography>
      {view.window === 'NOT_OPEN' ? <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{S.boardWindowNotOpen}</Typography> : null}
      {view.window === 'CLOSED' ? <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{S.boardWindowClosed}</Typography> : null}
      {canRate ? <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{S.boardAnonymousNote}</Typography> : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
        {view.points.map((p) => <RatingRow key={p.id} point={p} focus={focus} canRate={canRate} />)}
      </Box>
    </Card>
  );
}
