import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image as RNImage } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { teamAccentFromHue } from '@/design/team-accent';
import { Icon, Modal, TeamLogo } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import { useTeamLogo } from '@/features/teams/hooks/use-team-logo';
import { getTeamSettingsPanelStyles, rnText } from './team-settings-panel.styles';

interface TeamLogoSectionProps {
  teamId: number;
  token: string;
  teamName: string;
  logoUpdatedAt: string | null | undefined;
  accentHue: number | null | undefined;
  onChanged: () => void;
}

/** גרסת native של סעיף "לוגו הצוות" (פיצ'ר 19) — אותו hook, תצוגה ב-React Native. */
export function TeamLogoSection({ teamId, token, teamName, logoUpdatedAt, accentHue, onChanged }: TeamLogoSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);
  const c = useTeamLogo({ teamId, token, logoUpdatedAt, accentHue, onChanged });
  const hasLogo = !!logoUpdatedAt;
  const hasColor = accentHue !== null && accentHue !== undefined;

  const card = { gap: t.space[4], padding: t.space[4], borderRadius: t.radius.card, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface } as const;
  const rowStyle = { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[3] } as const;
  const body = { ...rnText(t.type.body), color: t.color.textSecondary, textAlign: 'right' } as const;
  const caption = { ...rnText(t.type.caption), color: t.color.textMuted, textAlign: 'right' } as const;
  const ghostText = { ...rnText(t.type.bodyStrong), color: t.color.textSecondary } as const;
  const ghostBtn = { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, minHeight: t.layout.minTouchTarget, paddingHorizontal: t.space[3], justifyContent: 'center' } as const;

  const swatch = (hue: number, selected: boolean) => ({
    width: t.layout.minTouchTarget,
    height: t.layout.minTouchTarget,
    borderRadius: t.radius.pill,
    borderWidth: 2,
    borderColor: selected ? teamAccentFromHue(hue, t.mode).base : 'transparent',
    padding: t.space[1],
  });

  return (
    <View style={s.detailsSection}>
      <Text style={s.sectionLabel}>{Strings.teamLogo.sectionTitle}</Text>

      {!!c.error && c.mode === 'idle' && (
        <View style={s.detailsMessage(true)}>
          <Text style={s.detailsMessageText(true)}>{c.error}</Text>
        </View>
      )}

      <View style={card}>
        <View style={rowStyle}>
          <TeamLogo teamId={teamId} name={teamName} logoUpdatedAt={logoUpdatedAt} size="xl" />
          <View style={{ flex: 1, flexShrink: 1, gap: t.space[1] }}>
            {hasLogo ? (
              <Text style={caption}>{Strings.teamLogo.updatedAt(formatDate(logoUpdatedAt as string))}</Text>
            ) : (
              <>
                <Text style={body}>{Strings.teamLogo.emptyDescription}</Text>
                <Text style={caption}>{Strings.teamLogo.formatsHint}</Text>
              </>
            )}
          </View>
        </View>

        {c.isConfirmingRemove ? (
          <View style={{ gap: t.space[2] }}>
            <Text style={{ ...rnText(t.type.bodyStrong), color: t.color.text, textAlign: 'right' }}>{Strings.teamLogo.removeConfirmTitle}</Text>
            <Text style={caption}>{Strings.teamLogo.removeConfirmBody}</Text>
            <View style={s.detailsButtonsRow}>
              <TouchableOpacity style={{ ...s.secondaryButton, borderColor: t.color.status.danger.border }} onPress={c.confirmRemove} disabled={c.isBusy}>
                {c.isBusy ? <ActivityIndicator size="small" color={t.color.status.danger.fg} /> : <Text style={{ ...s.secondaryButtonText, color: t.color.status.danger.fg }}>{Strings.teamLogo.removeConfirmButton}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={c.cancelRemove} disabled={c.isBusy}>
                <Text style={s.secondaryButtonText}>{Strings.teamLogo.cancelButton}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.detailsButtonsRow}>
            <TouchableOpacity style={s.secondaryButton} onPress={c.startUpload} disabled={c.isBusy}>
              {c.isBusy && c.mode === 'idle' ? <ActivityIndicator size="small" color={t.color.text} /> : (
                <Text style={s.secondaryButtonText}>{hasLogo ? Strings.teamLogo.replaceButton : Strings.teamLogo.uploadButton}</Text>
              )}
            </TouchableOpacity>
            {hasLogo && (
              <TouchableOpacity style={ghostBtn} onPress={c.askRemove} disabled={c.isBusy}>
                <Icon name="trash" size="sm" tone="danger" />
                <Text style={{ ...ghostText, color: t.color.status.danger.fg }}>{Strings.teamLogo.removeButton}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {hasLogo && (
          <>
            <View style={{ height: 1, backgroundColor: t.color.border }} />
            <View style={{ ...rowStyle, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[3], flexShrink: 1 }}>
                <View
                  testID="team-color-swatch"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: t.radius.pill,
                    backgroundColor: hasColor ? teamAccentFromHue(accentHue as number, t.mode).base : t.color.surfaceSubtle,
                    borderWidth: hasColor ? 0 : 1,
                    borderColor: t.color.borderStrong,
                  }}
                />
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ ...rnText(t.type.bodyStrong), color: t.color.text, textAlign: 'right' }}>
                    {hasColor ? Strings.teamLogo.colorFromLogo : Strings.teamLogo.colorNone}
                  </Text>
                  <Text style={caption}>{hasColor ? Strings.teamLogo.colorScopeHint : Strings.teamLogo.colorNoneHint}</Text>
                </View>
              </View>
              <TouchableOpacity style={ghostBtn} onPress={c.startRecolor} disabled={c.isBusy}>
                <Icon name="edit" size="sm" tone="muted" />
                <Text style={ghostText}>{Strings.teamLogo.colorChangeButton}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Modal open={c.mode !== 'idle'} onClose={c.cancel} title={c.mode === 'recolor' ? Strings.teamLogo.colorSectionTitle : Strings.teamLogo.dialogTitle} closeLabel={Strings.teamLogo.cancelButton}>
        {c.mode === 'upload' && c.prepared && (
          <View style={{ gap: t.space[2] }}>
            <Text style={s.sectionLabel}>{Strings.teamLogo.previewLabel}</Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: t.space[3] }}>
              {([56, 36, 24] as const).map((px) => (
                <RNImage
                  key={px}
                  testID="team-logo-preview"
                  source={{ uri: c.prepared!.uri }}
                  resizeMode="contain"
                  style={{
                    width: px,
                    height: px,
                    padding: Math.round(px * 0.12),
                    backgroundColor: t.color.logoSurface,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    borderRadius: px <= 28 ? t.radius.badge : px <= 40 ? t.radius.field : t.radius.card,
                  }}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: t.space[2] }}>
          <Text style={s.sectionLabel}>{Strings.teamLogo.colorSectionTitle}</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[1] }}>
            {c.hueOptions.map((hue, i) => (
              <TouchableOpacity
                key={hue}
                accessibilityRole="button"
                accessibilityLabel={Strings.teamLogo.colorOptionLabel(i + 1)}
                accessibilityState={{ selected: c.selectedHue === hue }}
                onPress={() => c.selectHue(hue)}
                style={swatch(hue, c.selectedHue === hue)}
              >
                <View style={{ flex: 1, borderRadius: t.radius.pill, backgroundColor: teamAccentFromHue(hue, t.mode).base, alignItems: 'center', justifyContent: 'center' }}>
                  {c.selectedHue === hue && <Icon name="check" size="sm" tone="inverse" />}
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{ ...ghostBtn, backgroundColor: c.selectedHue === null ? t.color.surfaceSubtle : 'transparent', borderRadius: t.radius.field }} onPress={() => c.selectHue(null)}>
              <Text style={ghostText}>{Strings.teamLogo.colorNone}</Text>
            </TouchableOpacity>
          </View>
          {c.hueOptions.length === 0 && <Text style={caption}>{Strings.teamLogo.colorNoneHint}</Text>}
        </View>

        {!!c.error && (
          <View style={s.detailsMessage(true)}>
            <Text style={s.detailsMessageText(true)}>{c.error}</Text>
          </View>
        )}

        <View style={s.detailsButtonsRow}>
          <TouchableOpacity style={s.primaryButton} onPress={c.mode === 'recolor' ? c.saveRecolor : c.save} disabled={c.isBusy}>
            {c.isBusy ? <ActivityIndicator size="small" color={t.color.accent.onBase} /> : <Text style={s.primaryButtonText}>{Strings.teamLogo.saveButton}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryButton} onPress={c.cancel} disabled={c.isBusy}>
            <Text style={s.secondaryButtonText}>{Strings.teamLogo.cancelButton}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
