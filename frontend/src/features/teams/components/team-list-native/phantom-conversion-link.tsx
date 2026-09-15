import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Share, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';

interface PhantomConversionLinkArgs {
  teamId: number;
  memberId: number;
  token: string;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

function inviteUrl(inviteToken: string) {
  return `${getFrontendUrl()}/invite/${inviteToken}`;
}

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — same UX pattern as
// the native InviteLinksPanel, scoped to a single phantom member: generates a one-time conversion
// link and shares it via the native Share sheet.
//
// Split into a hook + two small components (trigger button / result panel) instead of one block,
// so the row-owner (team-member-row.tsx) can place the trigger inline in its existing action
// cluster and only break to a new line for the result — see UI-GUIDELINES §11 (same fix as web).
export function usePhantomConversionLink({ teamId, memberId, token }: PhantomConversionLinkArgs) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

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
      trackEvent('phantom_conversion_link_created');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.invites.conversionLinkCreateError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    if (!linkToken) return;
    Share.share({ message: inviteUrl(linkToken) });
  };

  return { isLoading, error, linkToken, handleCreateLink, handleShare };
}

export type PhantomConversionLinkState = ReturnType<typeof usePhantomConversionLink>;

export function PhantomConversionButton({ state }: { state: PhantomConversionLinkState }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: t.space[2],
        paddingVertical: t.space[1],
        borderRadius: t.radius.field,
      }}
      onPress={state.handleCreateLink}
      disabled={state.isLoading}
    >
      {state.isLoading ? (
        <ActivityIndicator size="small" color={t.color.text} />
      ) : (
        <>
          <Icon name="link" size="sm" />
          <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.text }]}>
            {Strings.invites.sendConversionLinkButton}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function PhantomConversionPanel({ state }: { state: PhantomConversionLinkState }) {
  const t = useTheme();

  if (!state.error && !state.linkToken) return null;

  return (
    <View style={{ gap: t.space[2] }}>
      {!!state.error && (
        <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
          {state.error}
        </Text>
      )}

      {!!state.linkToken && (
        <View
          style={{
            backgroundColor: t.color.status.success.bg,
            borderWidth: 1,
            borderColor: t.color.status.success.border,
            borderRadius: t.radius.card,
            padding: t.space[3],
            gap: t.space[1],
          }}
        >
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.invites.conversionLinkCreatedText}
          </Text>
          <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
            {Strings.invites.conversionLinkCreatedSubtext}
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row-reverse',
              gap: t.space[1],
              backgroundColor: t.color.accent.base,
              borderRadius: t.radius.field,
              minHeight: t.layout.minTouchTarget,
              paddingHorizontal: t.space[3],
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'flex-end',
            }}
            onPress={state.handleShare}
          >
            <Icon name="copy" size="sm" tone="inverse" />
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
              {Strings.invites.copyLinkButton}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
