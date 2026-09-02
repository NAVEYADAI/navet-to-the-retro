import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Share, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import type { AppTheme } from '@/design/tokens';
import { trackEvent } from '@/lib/analytics';

interface InviteLinksPanelProps {
  teamId: number;
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

function inviteStatus(invite: any, t: AppTheme): { label: string; fg: string; bg: string; border: string } {
  if (invite.isRevoked) return { label: Strings.invites.statusRevoked, ...t.color.status.danger };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { label: Strings.invites.statusExpired, ...t.color.status.danger };
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { label: Strings.invites.statusExhausted, ...t.color.status.danger };
  return { label: Strings.invites.statusActive, ...t.color.status.success };
}

export function InviteLinksPanel({ teamId, token }: InviteLinksPanelProps) {
  const t = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newLinkToken, setNewLinkToken] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${teamId}/invites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setInvites(response.data);
    } catch (err) {
      console.error('Failed to fetch invite links:', err);
    }
  }, [teamId, token]);

  useEffect(() => {
    if (isExpanded) fetchInvites();
  }, [isExpanded, fetchInvites]);

  const handleCreateLink = async () => {
    setCreateError(null);
    if (expiresAt.trim() && new Date(expiresAt.trim()) <= new Date()) {
      setCreateError('תאריך התפוגה חייב להיות בעתיד');
      return;
    }
    setIsCreating(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/teams/${teamId}/invites`, {
        name: name.trim() || undefined,
        expiresAt: expiresAt.trim() || undefined,
        maxUses: maxUses.trim() ? Number(maxUses.trim()) : undefined,
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNewLinkToken(response.data.token);
      setName('');
      setExpiresAt('');
      setMaxUses('');
      setShowCreateForm(false);
      trackEvent('invite_link_created');
      fetchInvites();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'יצירת הקישור נכשלה.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (inviteId: number) => {
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/invites/${inviteId}`, { isRevoked: true }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchInvites();
    } catch (err) {
      console.error('Failed to revoke invite link:', err);
    }
  };

  const handleShare = (inviteToken: string) => {
    Share.share({ message: inviteUrl(inviteToken) });
  };

  const inputStyle = [
    rnText(t.type.body),
    {
      height: t.layout.minTouchTarget,
      borderWidth: 1,
      borderRadius: t.radius.field,
      paddingHorizontal: t.space[2],
      textAlign: 'right' as const,
      color: t.color.text,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
    },
  ];

  return (
    <View style={{ gap: t.space[2] }}>
      <TouchableOpacity style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }} onPress={() => setIsExpanded((v) => !v)}>
        <Icon name="chevron-down" size="sm" tone="muted" rotate={isExpanded ? 180 : 0} />
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.textSecondary, textAlign: 'right' }]}>
          {Strings.invites.manageLinksToggle}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={{ gap: t.space[2] }}>
          {newLinkToken && (
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
                {Strings.invites.linkCreatedText}
              </Text>
              <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                {Strings.invites.linkCreatedSubtext}
              </Text>
              <View style={{ backgroundColor: t.color.surface, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text selectable style={[rnText(t.type.caption), { color: t.color.text, textAlign: 'left' }]}>
                  {inviteUrl(newLinkToken)}
                </Text>
              </View>
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
                onPress={() => handleShare(newLinkToken)}
              >
                <Icon name="copy" size="sm" tone="inverse" />
                <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                  {Strings.invites.copyLinkButton}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {showCreateForm ? (
            <View
              style={{
                gap: t.space[2],
                padding: t.space[3],
                borderRadius: t.radius.card,
                backgroundColor: t.color.surfaceSubtle,
              }}
            >
              {!!createError && (
                <View
                  style={{
                    backgroundColor: t.color.status.danger.bg,
                    borderWidth: 1,
                    borderColor: t.color.status.danger.border,
                    borderRadius: t.radius.field,
                    padding: t.space[2],
                  }}
                >
                  <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
                    {createError}
                  </Text>
                </View>
              )}
              <Text style={[rnText(t.type.caption), { color: t.color.text, textAlign: 'right' }]}>
                {Strings.invites.nameLabel}
              </Text>
              <TextInput
                style={inputStyle}
                placeholder={Strings.invites.namePlaceholder}
                placeholderTextColor={t.color.textSecondary}
                value={name}
                onChangeText={setName}
              />
              <Text style={[rnText(t.type.caption), { color: t.color.text, textAlign: 'right' }]}>
                {Strings.invites.expiresAtLabel}
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={t.color.textSecondary}
                value={expiresAt}
                onChangeText={setExpiresAt}
              />
              <Text style={[rnText(t.type.caption), { color: t.color.text, textAlign: 'right' }]}>
                {Strings.invites.maxUsesLabel}
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="5"
                placeholderTextColor={t.color.textSecondary}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row-reverse',
                    gap: t.space[1],
                    backgroundColor: t.color.accent.base,
                    borderRadius: t.radius.field,
                    minHeight: t.layout.minTouchTarget,
                    paddingHorizontal: t.space[4],
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={handleCreateLink}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={t.color.accent.onBase} />
                  ) : (
                    <>
                      <Icon name="plus" size="sm" tone="inverse" />
                      <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                        {Strings.invites.createLinkButton}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: t.color.surface,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    borderRadius: t.radius.field,
                    minHeight: t.layout.minTouchTarget,
                    paddingHorizontal: t.space[4],
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowCreateForm(false)}
                >
                  <Text style={[rnText(t.type.bodyStrong), { color: t.color.text }]}>
                    {Strings.teamList.cancelButton}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                gap: t.space[1],
                backgroundColor: t.color.surfaceSubtle,
                borderRadius: t.radius.field,
                minHeight: t.layout.minTouchTarget,
                paddingHorizontal: t.space[3],
                justifyContent: 'center',
                alignItems: 'center',
                alignSelf: 'flex-end',
              }}
              onPress={() => setShowCreateForm(true)}
            >
              <Icon name="plus" size="sm" />
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.text }]}>
                {Strings.invites.createLinkButton}
              </Text>
            </TouchableOpacity>
          )}

          {invites.length === 0 ? (
            <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
              {Strings.invites.noLinksText}
            </Text>
          ) : (
            invites.map((invite) => {
              const status = inviteStatus(invite, t);
              const isActive = status.label === Strings.invites.statusActive;
              return (
                <View
                  key={invite.id}
                  style={{
                    backgroundColor: t.color.surfaceSubtle,
                    borderRadius: t.radius.card,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    paddingHorizontal: t.space[3],
                    paddingVertical: t.space[2],
                    gap: t.space[1],
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
                    <Text
                      style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right', flex: 1 }]}
                      numberOfLines={1}
                    >
                      {invite.name || invite.email || Strings.invites.unnamedLinkLabel}
                    </Text>
                    <View
                      style={{
                        backgroundColor: status.bg,
                        borderWidth: 1,
                        borderColor: status.border,
                        borderRadius: t.radius.badge,
                        paddingHorizontal: t.space[2],
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: status.fg }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
                    <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, flexShrink: 1 }]}>
                      {Strings.invites.usesLabel(invite.useCount, invite.maxUses)}
                    </Text>
                    {isActive && (
                      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[1] + 2 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: t.space[2],
                            paddingVertical: t.space[1],
                            borderRadius: t.radius.badge,
                            borderWidth: 1,
                            borderColor: t.color.border,
                          }}
                          onPress={() => handleShare(invite.token)}
                        >
                          <Icon name="copy" size="sm" />
                          <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.text }]}>
                            {Strings.invites.copyLinkButton}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row-reverse',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: t.space[2],
                            paddingVertical: t.space[1],
                            borderRadius: t.radius.badge,
                            borderWidth: 1,
                            borderColor: t.color.status.danger.border,
                          }}
                          onPress={() => handleRevoke(invite.id)}
                        >
                          <Icon name="trash" size="sm" tone="danger" />
                          <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.status.danger.fg }]}>
                            {Strings.invites.revokeButton}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
