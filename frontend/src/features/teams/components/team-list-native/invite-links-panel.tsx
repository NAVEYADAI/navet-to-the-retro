import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import type { TeamListTheme } from '@/features/teams/types';

interface InviteLinksPanelProps {
  teamId: number;
  token: string;
  theme: TeamListTheme;
}

function inviteUrl(inviteToken: string) {
  return `${getFrontendUrl()}/invite/${inviteToken}`;
}

function inviteStatus(invite: any): { label: string; color: string } {
  if (invite.isRevoked) return { label: Strings.invites.statusRevoked, color: '#c62828' };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { label: Strings.invites.statusExpired, color: '#c62828' };
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { label: Strings.invites.statusExhausted, color: '#c62828' };
  return { label: Strings.invites.statusActive, color: '#2e7d32' };
}

export function InviteLinksPanel({ teamId, token, theme }: InviteLinksPanelProps) {
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
    nativeStyles.input,
    { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background },
  ];

  return (
    <View style={{ gap: Spacing.two }}>
      <TouchableOpacity onPress={() => setIsExpanded(v => !v)}>
        <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.textSecondary, textAlign: 'right' }}>
          {isExpanded ? '▲ ' : '▼ '}{Strings.invites.manageLinksToggle}
        </ThemedText>
      </TouchableOpacity>

      {isExpanded && (
        <View style={{ gap: Spacing.two }}>
          {newLinkToken && (
            <View
              style={{
                backgroundColor: theme.background,
                borderRightWidth: 3,
                borderRightColor: '#2e7d32',
                borderRadius: 8,
                padding: Spacing.three,
                gap: Spacing.one,
              }}
            >
              <ThemedText style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right' }}>
                {Strings.invites.linkCreatedText}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
                {Strings.invites.linkCreatedSubtext}
              </ThemedText>
              <View style={{ backgroundColor: theme.backgroundElement, borderRadius: 6, padding: Spacing.two }}>
                <ThemedText selectable style={{ fontSize: 12, fontFamily: 'monospace', textAlign: 'left' }}>
                  {inviteUrl(newLinkToken)}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[nativeStyles.actionSaveBtn, { backgroundColor: theme.text, alignSelf: 'flex-end' }]}
                onPress={() => handleShare(newLinkToken)}
              >
                <ThemedText style={{ color: theme.background, fontSize: 12, fontWeight: 'bold' }}>
                  {Strings.invites.copyLinkButton}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {showCreateForm ? (
            <View style={[nativeStyles.editMemberPane, { gap: Spacing.one }]}>
              {!!createError && (
                <View style={nativeStyles.errorBannerInline}>
                  <ThemedText style={nativeStyles.errorTextInline}>{createError}</ThemedText>
                </View>
              )}
              <ThemedText style={{ fontSize: 12, textAlign: 'right' }}>{Strings.invites.nameLabel}</ThemedText>
              <TextInput
                style={inputStyle}
                placeholder={Strings.invites.namePlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />
              <ThemedText style={{ fontSize: 12, textAlign: 'right' }}>{Strings.invites.expiresAtLabel}</ThemedText>
              <TextInput
                style={inputStyle}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
                value={expiresAt}
                onChangeText={setExpiresAt}
              />
              <ThemedText style={{ fontSize: 12, textAlign: 'right' }}>{Strings.invites.maxUsesLabel}</ThemedText>
              <TextInput
                style={inputStyle}
                placeholder="5"
                placeholderTextColor={theme.textSecondary}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: 'row-reverse', gap: Spacing.two }}>
                <TouchableOpacity
                  style={[nativeStyles.actionSaveBtn, { backgroundColor: theme.text }]}
                  onPress={handleCreateLink}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={theme.background} />
                  ) : (
                    <ThemedText style={{ color: theme.background, fontSize: 12, fontWeight: 'bold' }}>
                      {Strings.invites.createLinkButton}
                    </ThemedText>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[nativeStyles.actionCancelBtn, { backgroundColor: theme.backgroundSelected }]}
                  onPress={() => setShowCreateForm(false)}
                >
                  <ThemedText style={{ fontSize: 12 }}>{Strings.teamList.cancelButton}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[nativeStyles.button, { backgroundColor: theme.backgroundSelected, alignSelf: 'flex-end', paddingHorizontal: Spacing.three }]}
              onPress={() => setShowCreateForm(true)}
            >
              <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
                {Strings.invites.createLinkButton}
              </ThemedText>
            </TouchableOpacity>
          )}

          {invites.length === 0 ? (
            <ThemedText style={{ fontSize: 12, opacity: 0.6, textAlign: 'right' }}>
              {Strings.invites.noLinksText}
            </ThemedText>
          ) : (
            invites.map((invite) => {
              const status = inviteStatus(invite);
              const isActive = status.label === Strings.invites.statusActive;
              return (
                <View
                  key={invite.id}
                  style={{
                    backgroundColor: theme.background,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.06)',
                    paddingHorizontal: Spacing.three,
                    paddingVertical: Spacing.two,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: 'bold', textAlign: 'right', flex: 1 }} numberOfLines={1}>
                      {invite.name || invite.email || Strings.invites.unnamedLinkLabel}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: status.color }}>
                      {status.label}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ fontSize: 11, opacity: 0.7 }}>
                      {Strings.invites.usesLabel(invite.useCount, invite.maxUses)}
                    </ThemedText>
                    {isActive && (
                      <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: theme.backgroundSelected,
                          }}
                          onPress={() => handleShare(invite.token)}
                        >
                          <ThemedText style={{ fontSize: 11, fontWeight: 'bold' }}>
                            {Strings.invites.copyLinkButton}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: '#c62828',
                          }}
                          onPress={() => handleRevoke(invite.id)}
                        >
                          <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#c62828' }}>
                            {Strings.invites.revokeButton}
                          </ThemedText>
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
