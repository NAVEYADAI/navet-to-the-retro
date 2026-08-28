import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl, getFrontendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { Box, Typography, Button, TextField, Alert, Chip, Collapse } from '@mui/material';
import type { TeamListTheme } from '@/features/teams/types';

interface InviteLinksPanelProps {
  teamId: number;
  token: string;
  theme: TeamListTheme;
}

function inviteUrl(inviteToken: string) {
  return `${getFrontendUrl()}/invite/${inviteToken}`;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
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

  const textFieldSx = { direction: 'rtl' as const };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Button
        onClick={() => setIsExpanded(v => !v)}
        sx={{ alignSelf: 'flex-end', color: theme.textSecondary, fontWeight: 'bold', fontSize: 13, fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
      >
        {isExpanded ? '▲ ' : '▼ '}{Strings.invites.manageLinksToggle}
      </Button>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {newLinkToken && (
            <Box
              sx={{
                backgroundColor: theme.background,
                borderInlineStart: '3px solid #2e7d32',
                borderRadius: 1.5,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif', textAlign: 'right' }}>
                {Strings.invites.linkCreatedText}
              </Typography>
              <Typography sx={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif', textAlign: 'right' }}>
                {Strings.invites.linkCreatedSubtext}
              </Typography>
              <Box
                sx={{
                  backgroundColor: theme.backgroundElement,
                  borderRadius: 1,
                  p: 1.2,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  textAlign: 'left',
                  direction: 'ltr',
                  color: theme.text,
                }}
              >
                {inviteUrl(newLinkToken)}
              </Box>
              <Button
                onClick={() => handleCopy(newLinkToken)}
                sx={{
                  alignSelf: 'flex-end',
                  backgroundColor: theme.text,
                  color: theme.background,
                  fontSize: 12,
                  fontWeight: 'bold',
                  fontFamily: 'Rubik, sans-serif',
                  textTransform: 'none',
                  px: 2,
                  '&:hover': { backgroundColor: theme.text, opacity: 0.85 },
                }}
              >
                {copied ? Strings.invites.linkCopiedText : Strings.invites.copyLinkButton}
              </Button>
            </Box>
          )}

          {showCreateForm ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 2 }}>
              {createError && (
                <Alert severity="error" sx={{ flexDirection: 'row-reverse', textAlign: 'right' }}>{createError}</Alert>
              )}
              <TextField
                label={Strings.invites.nameLabel}
                placeholder={Strings.invites.namePlaceholder}
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                size="small"
                sx={textFieldSx}
              />
              <TextField
                label={Strings.invites.expiresAtLabel}
                type="date"
                value={expiresAt}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayDateString() } }}
                sx={textFieldSx}
              />
              <TextField
                label={Strings.invites.maxUsesLabel}
                type="number"
                value={maxUses}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxUses(e.target.value)}
                size="small"
                sx={textFieldSx}
              />
              <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={handleCreateLink}
                  disabled={isCreating}
                  sx={{ backgroundColor: theme.text, color: theme.background, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
                >
                  {Strings.invites.createLinkButton}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowCreateForm(false)}
                  sx={{ borderColor: theme.backgroundSelected, color: theme.text, fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
                >
                  {Strings.teamList.cancelButton}
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="outlined"
              onClick={() => setShowCreateForm(true)}
              sx={{ alignSelf: 'flex-end', borderColor: theme.backgroundSelected, color: theme.text, fontSize: 12, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif', textTransform: 'none' }}
            >
              {Strings.invites.createLinkButton}
            </Button>
          )}

          {invites.length === 0 ? (
            <Typography sx={{ fontSize: 12, opacity: 0.6, textAlign: 'right', fontFamily: 'Rubik, sans-serif' }}>
              {Strings.invites.noLinksText}
            </Typography>
          ) : (
            invites.map((invite) => {
              const status = inviteStatus(invite);
              const isActive = status.label === Strings.invites.statusActive;
              return (
                <Box
                  key={invite.id}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, px: 2, py: 1.2, backgroundColor: theme.background, borderRadius: 2, border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
                      {invite.name || invite.email || Strings.invites.unnamedLinkLabel}
                    </Typography>
                    <Chip label={status.label} size="small" sx={{ backgroundColor: `${status.color}1a`, color: status.color, fontWeight: 'bold', fontSize: 11, fontFamily: 'Rubik, sans-serif' }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 11, opacity: 0.7, fontFamily: 'Rubik, sans-serif', color: theme.textSecondary }}>
                      {Strings.invites.usesLabel(invite.useCount, invite.maxUses)}
                    </Typography>
                    {isActive && (
                      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleCopyRow(invite)}
                          sx={{
                            borderColor: theme.backgroundSelected,
                            color: theme.text,
                            fontWeight: 'bold',
                            fontSize: 11,
                            fontFamily: 'Rubik, sans-serif',
                            textTransform: 'none',
                            px: 1.5,
                          }}
                        >
                          {copiedRowId === invite.id ? Strings.invites.linkCopiedText : Strings.invites.copyLinkButton}
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleRevoke(invite.id)}
                          sx={{
                            borderColor: '#c62828',
                            color: '#c62828',
                            fontWeight: 'bold',
                            fontSize: 11,
                            fontFamily: 'Rubik, sans-serif',
                            textTransform: 'none',
                            px: 1.5,
                            '&:hover': { borderColor: '#c62828', backgroundColor: 'rgba(198,40,40,0.06)' },
                          }}
                        >
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
