import React, { useId, useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Card, Collapse, Field } from '@/components/ui';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { formatDate } from '@/lib/format-date';
import { formatUserDisplayName } from '../comment-display';
import type { CategoryOption } from '../comment-types';
import type { useWriteExtensions } from '../hooks/use-write-extensions';

/**
 * Feature 13 §13.0 decision #2 — "הארכת כתיבה": admin only (the board decides whether to render it).
 * Pick an active member and an end date to open the locked board to them; revoke early.
 */
export function WriteExtensionsPanelWeb({ extensions, memberOptions }: { extensions: ReturnType<typeof useWriteExtensions>; memberOptions: CategoryOption[] }) {
  const t = useTheme();
  const { isOpen, items, isLoading, isSaving, error, grantError, toggle, refresh, grant, revoke } = extensions;
  const regionId = useId();
  const [userId, setUserId] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGrant = async () => {
    if (await grant(userId, endDate)) {
      setUserId('');
      setEndDate('');
    }
  };

  return (
    <GuideAnchor name="board-write-extensions">
      <Card>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
          <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0, minWidth: 0 }}>
            {Strings.retroBoard.extensionsPanelTitle}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` }}>
            {isOpen ? (
              <Button variant="ghost" size="sm" icon="refresh" iconOnlyOnMobile onPress={refresh} disabled={isLoading}>
                {Strings.common.refreshButton}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onPress={toggle}
              ariaLabel={isOpen ? Strings.retroBoard.extensionsPanelCloseLabel : Strings.retroBoard.extensionsPanelOpenLabel}
              ariaExpanded={isOpen}
              ariaControls={regionId}
            >
              {isOpen ? Strings.retroBoard.adminToolsCloseButton : Strings.retroBoard.adminToolsOpenButton}
            </Button>
          </Box>
        </Box>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.retroBoard.extensionsPanelHint}</Typography>

        <Collapse open={isOpen} id={regionId}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px` }}>
            {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
              <Typography sx={{ ...t.type.overline, color: t.color.textMuted }}>{Strings.retroBoard.extensionsActiveHeader}</Typography>
              {items.length === 0 ? (
                <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                  {isLoading ? Strings.retroBoard.extensionsLoading : Strings.retroBoard.extensionsNoneActive}
                </Typography>
              ) : items.map((ext) => (
                <Box
                  key={ext.id}
                  data-testid="write-extension"
                  sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px`, borderBlockEnd: `1px solid ${t.color.border}`, paddingBlockEnd: `${t.space[2]}px` }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}><bdi>{formatUserDisplayName(ext.user)}</bdi></Typography>
                    <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}><bdi>{Strings.retroBoard.extensionsUntil(formatDate(ext.expiresAt))}</bdi></Typography>
                  </Box>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="x"
                    onPress={() => revoke(ext.id)}
                    disabled={isSaving}
                    ariaLabel={Strings.retroBoard.extensionsRevokeLabel(formatUserDisplayName(ext.user))}
                  >
                    {Strings.retroBoard.extensionsRevokeButton}
                  </Button>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: `${t.space[3]}px` }}>
              <Field
                type="select"
                label={Strings.retroBoard.extensionsMemberLabel}
                placeholder={Strings.retroBoard.extensionsMemberPlaceholder}
                value={userId}
                onChangeText={setUserId}
                options={memberOptions}
              />
              <Field type="date" label={Strings.retroBoard.extensionsEndDateLabel} value={endDate} onChangeText={setEndDate} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, alignItems: 'flex-start' }}>
              <Button variant="secondary" size="sm" icon="check" onPress={handleGrant} disabled={isSaving} loading={isSaving}>
                {Strings.retroBoard.extensionsGrantButton}
              </Button>
              {grantError ? <Alert severity="error" role="alert" sx={{ ...t.type.body, alignSelf: 'stretch' }}>{grantError}</Alert> : null}
            </Box>
          </Box>
        </Collapse>
      </Card>
    </GuideAnchor>
  );
}
