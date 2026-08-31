import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Alert, Collapse } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Badge, Icon } from '@/components/ui';
import type { Tone } from '@/components/ui';

interface InviteLinksPanelProps {
  teamId: number;
  token: string;
}

function inviteUrl(inviteToken: string) {
  return `${getFrontendUrl()}/invite/${inviteToken}`;
}

function inviteStatus(invite: any): { label: string; tone: Tone } {
  if (invite.isRevoked) return { label: Strings.invites.statusRevoked, tone: 'danger' };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { label: Strings.invites.statusExpired, tone: 'danger' };
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { label: Strings.invites.statusExhausted, tone: 'danger' };
  return { label: Strings.invites.statusActive, tone: 'success' };
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
  const [copied, setCopied] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<number | null>(null);

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
      setCopied(false);
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

  const handleCopy = async (inviteToken: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(inviteToken));
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  };

  const handleCopyRow = async (invite: { id: number; token: string }) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.token));
      setCopiedRowId(invite.id);
      setTimeout(() => setCopiedRowId((current) => (current === invite.id ? null : current)), 1500);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
      <Button size="sm" variant="ghost" onPress={() => setIsExpanded((v) => !v)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
          <Icon name="chevron-down" size="sm" tone="muted" rotate={isExpanded ? 180 : 0} />
          {Strings.invites.manageLinksToggle}
        </Box>
      </Button>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
          {newLinkToken && (
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
                {Strings.invites.linkCreatedText}
              </Typography>
              <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                {Strings.invites.linkCreatedSubtext}
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
                <bdi>{inviteUrl(newLinkToken)}</bdi>
              </Box>
              <Button size="sm" variant="primary" icon={copied ? 'check' : 'copy'} onPress={() => handleCopy(newLinkToken)}>
                {copied ? Strings.invites.linkCopiedText : Strings.invites.copyLinkButton}
              </Button>
            </Box>
          )}

          {showCreateForm ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${t.space[3]}px`,
                padding: `${t.space[4]}px`,
                border: `1px solid ${t.color.border}`,
                borderRadius: `${t.radius.card}px`,
              }}
            >
              {createError && (
                <Alert severity="error" sx={{ ...t.type.body }}>
                  {createError}
                </Alert>
              )}
              <Field
                label={Strings.invites.nameLabel}
                placeholder={Strings.invites.namePlaceholder}
                value={name}
                onChangeText={setName}
              />
              <Field
                label={Strings.invites.expiresAtLabel}
                type="date"
                value={expiresAt}
                onChangeText={setExpiresAt}
              />
              <Field
                label={Strings.invites.maxUsesLabel}
                type="number"
                value={maxUses}
                onChangeText={setMaxUses}
              />
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: `${t.space[3]}px` }}>
                <Button variant="primary" icon="plus" onPress={handleCreateLink} disabled={isCreating} loading={isCreating}>
                  {Strings.invites.createLinkButton}
                </Button>
                <Button variant="secondary" onPress={() => setShowCreateForm(false)}>
                  {Strings.teamList.cancelButton}
                </Button>
              </Box>
            </Box>
          ) : (
            <Button size="sm" variant="secondary" icon="plus" onPress={() => setShowCreateForm(true)}>
              {Strings.invites.createLinkButton}
            </Button>
          )}

          {invites.length === 0 ? (
            <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
              {Strings.invites.noLinksText}
            </Typography>
          ) : (
            invites.map((invite) => {
              const status = inviteStatus(invite);
              const isActive = status.label === Strings.invites.statusActive;
              return (
                <Box
                  key={invite.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${t.space[2]}px`,
                    paddingInline: `${t.space[4]}px`,
                    paddingBlock: `${t.space[3]}px`,
                    backgroundColor: t.color.surfaceSubtle,
                    borderRadius: `${t.radius.card}px`,
                    border: `1px solid ${t.color.border}`,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[2]}px` }}>
                    <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
                      {invite.name || invite.email || Strings.invites.unnamedLinkLabel}
                    </Typography>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[2]}px` }}>
                    <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                      {Strings.invites.usesLabel(invite.useCount, invite.maxUses)}
                    </Typography>
                    {isActive && (
                      <Box sx={{ display: 'flex', flexDirection: 'row', gap: `${t.space[2]}px` }}>
                        <Button size="sm" variant="secondary" icon={copiedRowId === invite.id ? 'check' : 'copy'} onPress={() => handleCopyRow(invite)}>
                          {copiedRowId === invite.id ? Strings.invites.linkCopiedText : Strings.invites.copyLinkButton}
                        </Button>
                        <Button size="sm" variant="danger" icon="trash" onPress={() => handleRevoke(invite.id)}>
                          {Strings.invites.revokeButton}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
