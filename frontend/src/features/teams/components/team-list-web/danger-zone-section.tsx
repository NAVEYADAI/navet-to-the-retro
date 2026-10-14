import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field } from '@/components/ui';
import { useDeleteTeam } from '@/features/teams/hooks/use-delete-team';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';

interface DangerZoneSectionProps {
  teamId: number;
  teamName: string;
  token: string;
  /** נקרא אחרי מחיקה — רשימת הצוותים נטענת מחדש והצוות נעלם ממנה. */
  onDeleted: () => void;
}

/**
 * Feature 14 (product-backlog/14-sprint-and-team-deletion.md §14.2, decision #4) — "אזור מסוכן" at the
 * bottom of the team settings: deleting the team needs its exact name typed, and says it can be
 * restored for 30 days. Any admin of the team sees it.
 */
export function DangerZoneSection({ teamId, teamName, token, onDeleted }: DangerZoneSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);
  const d = useDeleteTeam({ teamId, teamName, token, onDeleted });

  return (
    <Box sx={s.detailsSection}>
      <Typography sx={{ ...s.sectionLabel, color: t.color.status.danger.fg }}>{Strings.teamDeletion.dangerZoneTitle}</Typography>

      <Box
        data-testid="danger-zone"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${t.space[3]}px`,
          padding: `${t.space[4]}px`,
          backgroundColor: t.color.surface,
          border: `1px solid ${t.color.status.danger.border}`,
          borderRadius: `${t.radius.card}px`,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, flex: '1 1 220px', minWidth: 0 }}>
            <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>{Strings.teamDeletion.deleteTeamTitle}</Typography>
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{Strings.teamDeletion.deleteTeamDescription}</Typography>
          </Box>
          {!d.isOpen && (
            <Button variant="danger" size="sm" icon="trash" onPress={d.open}>
              {Strings.teamDeletion.deleteTeamButton}
            </Button>
          )}
        </Box>

        {d.isOpen && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
            <Typography sx={{ ...t.type.body, color: t.color.text }}>{Strings.teamDeletion.confirmPrompt(teamName)}</Typography>
            <Field
              label={Strings.teamDeletion.confirmLabel}
              placeholder={Strings.teamDeletion.confirmPlaceholder}
              value={d.typedName}
              onChangeText={d.setTypedName}
            />
            {d.error && <Alert severity="error" sx={{ ...t.type.body }}>{d.error}</Alert>}
            <Box sx={s.detailsButtonsRow}>
              <Button variant="danger" size="sm" onPress={d.confirm} disabled={!d.canConfirm || d.isDeleting} loading={d.isDeleting}>
                {Strings.teamDeletion.confirmButton}
              </Button>
              <Button variant="secondary" size="sm" onPress={d.cancel} disabled={d.isDeleting}>
                {Strings.teamDeletion.cancelButton}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
