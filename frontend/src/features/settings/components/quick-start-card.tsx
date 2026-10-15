import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { Button, Card } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useQuickStart } from '@/features/onboarding';

const S = Strings.onboarding;

/** Feature 21 §21.0 #13 — the way back to the dashboard's starter checklist after "הסתר". */
export function QuickStartCard() {
  const t = useTheme();
  const { token } = useAuth();
  const q = useQuickStart(token);
  if (!q.loaded) return null;
  const text = q.dismissed ? S.quickStartDismissedText : q.complete ? S.quickStartCompleteText : S.quickStartVisibleText;
  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>{S.quickStartTitle}</Typography>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{S.quickStartSubtitle}</Typography>
      </Box>
      {q.error ? <Alert severity="error" sx={{ ...t.type.body }}>{q.error}</Alert> : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
        <Typography data-testid="quick-start-status" sx={{ ...t.type.body, color: t.color.textSecondary, minWidth: 0 }}>{text}</Typography>
        {q.dismissed ? (
          <Button
            variant="secondary"
            size="sm"
            loading={q.restoring}
            disabled={q.restoring}
            onPress={() => { trackEvent('onboarding_restore_clicked', { screen: 'settings' }); void q.restore(); }}
          >
            {S.quickStartRestoreButton}
          </Button>
        ) : null}
      </Box>
    </Card>
  );
}
