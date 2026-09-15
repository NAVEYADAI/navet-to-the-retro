import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Collapse, Alert } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';

interface PhantomConversionLinkArgs {
  teamId: number;
  memberId: number;
  token: string;
}

function inviteUrl(inviteToken: string) {
  return `${getFrontendUrl()}/invite/${inviteToken}`;
}

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — same UX pattern as
// InviteLinksPanel (invite-links-panel.tsx), scoped to a single phantom member: generates a
// one-time conversion link via `POST /teams/:teamId/phantom-members/:memberId/conversion-invite`
// and displays/copies the resulting URL.
//
// Split into a hook + two small components (trigger button / result panel) instead of one block,
// so the row-owner (team-member-row.tsx) can place the trigger inline in its existing action
// cluster and only break to a new line for the result — see UI-GUIDELINES §11.
export function usePhantomConversionLink({ teamId, memberId, token }: PhantomConversionLinkArgs) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateLink = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await axios.post(
        `${getBackendUrl()}/teams/${teamId}/phantom-members/${memberId}/conversion-invite`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setLinkToken(response.data.token);
      setCopied(false);
      trackEvent('phantom_conversion_link_created');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.invites.conversionLinkCreateError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!linkToken) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(linkToken));
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy conversion link:', err);
    }
  };

  return { isLoading, error, linkToken, copied, handleCreateLink, handleCopy };
}

export type PhantomConversionLinkState = ReturnType<typeof usePhantomConversionLink>;

export function PhantomConversionButton({ state }: { state: PhantomConversionLinkState }) {
  return (
    <Button size="sm" variant="secondary" icon="link" onPress={state.handleCreateLink} disabled={state.isLoading} loading={state.isLoading}>
      {Strings.invites.sendConversionLinkButton}
    </Button>
  );
}

export function PhantomConversionPanel({ state }: { state: PhantomConversionLinkState }) {
  const t = useTheme();

  if (!state.error && !state.linkToken) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
      {state.error && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {state.error}
        </Alert>
      )}

      <Collapse in={!!state.linkToken} timeout="auto" unmountOnExit>
        {state.linkToken && (
          <Box
            sx={{
              backgroundColor: t.color.status.success.bg,
              borderInlineStart: `3px solid ${t.color.status.success.fg}`,
              borderRadius: `${t.radius.card}px`,
              padding: `${t.space[4]}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: `${t.space[2]}px`,
            }}
          >
            <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
              {Strings.invites.conversionLinkCreatedText}
            </Typography>
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
              {Strings.invites.conversionLinkCreatedSubtext}
            </Typography>
            <Box
              sx={{
                backgroundColor: t.color.surface,
                borderRadius: `${t.radius.field}px`,
                padding: `${t.space[2]}px`,
                ...t.type.caption,
                color: t.color.text,
                wordBreak: 'break-all',
              }}
            >
              <bdi>{inviteUrl(state.linkToken)}</bdi>
            </Box>
            <Button size="sm" variant="primary" icon={state.copied ? 'check' : 'copy'} onPress={state.handleCopy}>
              {state.copied ? Strings.invites.linkCopiedText : Strings.invites.copyLinkButton}
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
