import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { teamAccentFromHue } from '@/design/team-accent';
import { Button, Icon, Modal, TeamLogo } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import { useTeamLogo } from '@/features/teams/hooks/use-team-logo';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';

interface TeamLogoSectionProps {
  teamId: number;
  token: string;
  teamName: string;
  logoUpdatedAt: string | null | undefined;
  accentHue: number | null | undefined;
  onChanged: () => void;
}

/**
 * Feature 19 (product-backlog/19-team-logo.md) — סעיף "לוגו הצוות" בהגדרות הצוות, למנהל בלבד.
 * מצב תצוגה כברירת מחדל (UI-GUIDELINES §12): לוגו + "החלפה"/"הסרה"; ההעלאה והשינוי נפתחים בדיאלוג.
 */
export function TeamLogoSection({ teamId, token, teamName, logoUpdatedAt, accentHue, onChanged }: TeamLogoSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);
  const c = useTeamLogo({ teamId, token, logoUpdatedAt, accentHue, onChanged });
  const hasLogo = !!logoUpdatedAt;
  const hasColor = accentHue !== null && accentHue !== undefined;

  const card = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.space[4]}px`,
    backgroundColor: t.color.surface,
    border: `1px solid ${t.color.border}`,
    borderRadius: `${t.radius.card}px`,
    padding: `${t.space[4]}px`,
  } as const;
  const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[3]}px` } as const;
  const swatch = (hue: number | null, selected = false) => ({
    width: t.layout.minTouchTarget,
    height: t.layout.minTouchTarget,
    boxSizing: 'border-box',
    padding: `${t.space[1]}px`,
    borderRadius: `${t.radius.pill}px`,
    border: `2px solid ${selected ? (hue === null ? t.color.borderStrong : teamAccentFromHue(hue, t.mode).base) : 'transparent'}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `border-color ${t.motion.fast}`,
    '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
  });
  const dot = (hue: number) => ({
    width: '100%',
    height: '100%',
    borderRadius: `${t.radius.pill}px`,
    backgroundColor: teamAccentFromHue(hue, t.mode).base,
    color: teamAccentFromHue(hue, t.mode).onBase,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const colorPicker = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
      <Typography sx={s.sectionLabel}>{Strings.teamLogo.colorSectionTitle}</Typography>
      <Box sx={{ ...row, gap: `${t.space[1]}px` }}>
        {c.hueOptions.map((hue, i) => (
          <Box
            key={hue}
            component="button"
            type="button"
            aria-label={Strings.teamLogo.colorOptionLabel(i + 1)}
            aria-pressed={c.selectedHue === hue}
            onClick={() => c.selectHue(hue)}
            sx={swatch(hue, c.selectedHue === hue)}
          >
            <Box component="span" sx={dot(hue)}>
              {c.selectedHue === hue && <Icon name="check" size="sm" tone="inverse" />}
            </Box>
          </Box>
        ))}
        <Button variant={c.selectedHue === null ? 'secondary' : 'ghost'} size="sm" onPress={() => c.selectHue(null)}>
          {Strings.teamLogo.colorNone}
        </Button>
      </Box>
      {c.hueOptions.length === 0 && (
        <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{Strings.teamLogo.colorNoneHint}</Typography>
      )}
    </Box>
  );

  return (
    <Box sx={s.detailsSection}>
      <Typography sx={s.sectionLabel}>{Strings.teamLogo.sectionTitle}</Typography>

      {c.error && c.mode === 'idle' && (
        <Alert severity="error" sx={{ ...t.type.body }}>{c.error}</Alert>
      )}

      <Box sx={card}>
        <Box sx={row}>
          <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="xl" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px`, flex: '1 1 0', minWidth: 0 }}>
            {hasLogo ? (
              <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>
                {Strings.teamLogo.updatedAt(formatDate(logoUpdatedAt as string))}
              </Typography>
            ) : (
              <>
                <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{Strings.teamLogo.emptyDescription}</Typography>
                <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>{Strings.teamLogo.formatsHint}</Typography>
              </>
            )}
          </Box>
        </Box>

        {c.isConfirmingRemove ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
            <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>{Strings.teamLogo.removeConfirmTitle}</Typography>
            <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{Strings.teamLogo.removeConfirmBody}</Typography>
            <Box sx={row}>
              <Button variant="danger" size="sm" onPress={c.confirmRemove} disabled={c.isBusy} loading={c.isBusy}>
                {Strings.teamLogo.removeConfirmButton}
              </Button>
              <Button variant="secondary" size="sm" onPress={c.cancelRemove} disabled={c.isBusy}>
                {Strings.teamLogo.cancelButton}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={row}>
            <Button variant="secondary" size="sm" icon="upload" onPress={c.startUpload} disabled={c.isBusy} loading={c.isBusy && c.mode === 'idle'}>
              {hasLogo ? Strings.teamLogo.replaceButton : Strings.teamLogo.uploadButton}
            </Button>
            {hasLogo && (
              <Button variant="ghost" size="sm" icon="trash" onPress={c.askRemove} disabled={c.isBusy}>
                {Strings.teamLogo.removeButton}
              </Button>
            )}
          </Box>
        )}

        {hasLogo && (
          <>
            <Box sx={{ height: '1px', backgroundColor: t.color.border }} />
            <Box sx={{ ...row, justifyContent: 'space-between' }}>
              <Box sx={{ ...row, gap: `${t.space[3]}px` }}>
                <Box
                  component="span"
                  data-testid="team-color-swatch"
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: `${t.radius.pill}px`,
                    backgroundColor: hasColor ? teamAccentFromHue(accentHue as number, t.mode).base : t.color.surfaceSubtle,
                    border: hasColor ? 'none' : `1px solid ${t.color.borderStrong}`,
                  }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
                    {hasColor ? Strings.teamLogo.colorFromLogo : Strings.teamLogo.colorNone}
                  </Typography>
                  <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                    {hasColor ? Strings.teamLogo.colorScopeHint : Strings.teamLogo.colorNoneHint}
                  </Typography>
                </Box>
              </Box>
              <Button variant="ghost" size="sm" icon="edit" onPress={c.startRecolor} disabled={c.isBusy}>
                {Strings.teamLogo.colorChangeButton}
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* דיאלוג: העלאה (תצוגה מקדימה + צבע) או שינוי צבע בלבד. */}
      <Modal open={c.mode !== 'idle'} onClose={c.cancel} title={c.mode === 'recolor' ? Strings.teamLogo.colorSectionTitle : Strings.teamLogo.dialogTitle} closeLabel={Strings.teamLogo.cancelButton}>
        {c.mode === 'upload' && c.prepared && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px` }}>
            <Typography sx={s.sectionLabel}>{Strings.teamLogo.previewLabel}</Typography>
            <Box sx={{ ...row, alignItems: 'flex-end' }}>
              {([56, 36, 24] as const).map((px) => (
                <Box
                  key={px}
                  component="img"
                  src={c.prepared!.uri}
                  alt=""
                  data-testid="team-logo-preview"
                  sx={{
                    width: px,
                    height: px,
                    boxSizing: 'border-box',
                    padding: `${Math.round(px * 0.12)}px`,
                    objectFit: 'contain',
                    backgroundColor: t.color.logoSurface,
                    border: `1px solid ${t.color.border}`,
                    borderRadius: `${px <= 28 ? t.radius.badge : px <= 40 ? t.radius.field : t.radius.card}px`,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {colorPicker}

        {c.error && <Alert severity="error" sx={{ ...t.type.body }}>{c.error}</Alert>}

        <Box sx={{ ...row, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onPress={c.cancel} disabled={c.isBusy}>{Strings.teamLogo.cancelButton}</Button>
          <Button variant="primary" onPress={c.mode === 'recolor' ? c.saveRecolor : c.save} disabled={c.isBusy} loading={c.isBusy}>
            {Strings.teamLogo.saveButton}
          </Button>
        </Box>
      </Modal>
    </Box>
  );
}
