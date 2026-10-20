import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Field, Segmented } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { emitGuideSignal } from './guide-signals';

const G = Strings.onboarding.guide;

type Kind = 'KEEP' | 'IMPROVE';
interface DemoComment { id: string; kind: Kind; text: string }

const SEED: DemoComment[] = [
  ...G.demoComments.keep.map((text, i): DemoComment => ({ id: `k${i}`, kind: 'KEEP', text })),
  ...G.demoComments.improve.map((text, i): DemoComment => ({ id: `i${i}`, kind: 'IMPROVE', text })),
];

/**
 * A client-side-only retro board for users who have no active sprint yet (§22.0 default #12): the
 * same idea as the real board — write a note as keep / improve, see it land in its column — but
 * nothing is sent to the API or saved, so it can never show up in a summary, a deck or another
 * member's view. The compose form works, and posting a note is what moves the guide on.
 */
export function GuideDemoBoardWeb() {
  const t = useTheme();
  const [comments, setComments] = useState<DemoComment[]>(SEED);
  const [kind, setKind] = useState<Kind>('KEEP');
  const [text, setText] = useState('');

  const post = () => {
    const value = text.trim();
    if (!value) return;
    trackEvent('guide_demo_comment_posted', { kind });
    setComments((c) => [{ id: `n${c.length}`, kind, text: value }, ...c]);
    setText('');
    emitGuideSignal('comment-posted');
  };

  const column = (k: Kind, label: string) => {
    const items = comments.filter((c) => c.kind === k);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, minWidth: 0 }}>
        <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>{label}</Typography>
        {items.length === 0 ? <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{G.demoEmpty}</Typography> : null}
        {items.map((c) => (
          <Box key={c.id} data-testid="demo-comment" sx={{ ...t.type.body, color: t.color.text, padding: `${t.space[2]}px ${t.space[3]}px`, border: `1px solid ${t.color.border}`, borderRadius: `${t.radius.field}px`, backgroundColor: t.color.surfaceSubtle, overflowWrap: 'anywhere' }}>
            {c.text}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box data-testid="guide-demo-board" sx={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <Card>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2]}px` }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{G.demoTitle}</Typography>
          <Badge tone="neutral">{G.demoBadge}</Badge>
        </Box>
        <GuideAnchor name="demo-compose">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
            <Segmented
              value={kind}
              onChange={(v) => setKind(v as Kind)}
              options={[{ value: 'KEEP', label: G.demoKeepLabel }, { value: 'IMPROVE', label: G.demoImproveLabel }]}
            />
            <Field
              type="textarea"
              label={kind === 'KEEP' ? G.demoKeepLabel : G.demoImproveLabel}
              value={text}
              onChangeText={setText}
              placeholder={kind === 'KEEP' ? G.demoKeepPlaceholder : G.demoImprovePlaceholder}
              rows={2}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onPress={post} disabled={!text.trim()}>{G.demoPostButton}</Button>
            </Box>
          </Box>
        </GuideAnchor>
      </Card>
      <GuideAnchor name="demo-comments">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: `${t.space[3]}px`, padding: `${t.space[3]}px`, borderRadius: `${t.radius.card}px`, backgroundColor: t.color.surface, border: `1px solid ${t.color.border}` }}>
          {column('KEEP', G.demoKeepLabel)}
          {column('IMPROVE', G.demoImproveLabel)}
        </Box>
      </GuideAnchor>
    </Box>
  );
}
