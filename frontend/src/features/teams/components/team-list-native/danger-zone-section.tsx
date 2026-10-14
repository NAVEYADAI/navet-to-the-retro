import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { useDeleteTeam } from '@/features/teams/hooks/use-delete-team';
import { getTeamSettingsPanelStyles, rnText } from './team-settings-panel.styles';

interface DangerZoneSectionProps {
  teamId: number;
  teamName: string;
  token: string;
  onDeleted: () => void;
}

/** גרסת native של "אזור מסוכן" (פיצ'ר 14, §14.2) — אותו hook, תצוגה ב-React Native. */
export function DangerZoneSection({ teamId, teamName, token, onDeleted }: DangerZoneSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);
  const d = useDeleteTeam({ teamId, teamName, token, onDeleted });

  const dangerButton = (enabled: boolean) => ({
    minHeight: t.layout.minTouchTarget,
    paddingHorizontal: t.space[4],
    borderRadius: t.radius.field,
    backgroundColor: t.color.status.danger.fg,
    opacity: enabled ? 1 : 0.45,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexDirection: 'row-reverse' as const,
    gap: 4,
  });

  return (
    <View style={s.detailsSection}>
      <Text style={[s.sectionLabel, { color: t.color.status.danger.fg }]}>{Strings.teamDeletion.dangerZoneTitle}</Text>

      <View
        testID="danger-zone"
        style={{ gap: t.space[3], padding: t.space[4], backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.card }}
      >
        <View style={{ gap: t.space[1] }}>
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{Strings.teamDeletion.deleteTeamTitle}</Text>
          <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.teamDeletion.deleteTeamDescription}</Text>
        </View>

        {!d.isOpen ? (
          <TouchableOpacity accessibilityRole="button" style={[dangerButton(true), { alignSelf: 'flex-end' }]} onPress={d.open}>
            <Icon name="trash" size="sm" tone="inverse" />
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.surface }]}>{Strings.teamDeletion.deleteTeamButton}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: t.space[3] }}>
            <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{Strings.teamDeletion.confirmPrompt(teamName)}</Text>
            <Text style={s.fieldLabel}>{Strings.teamDeletion.confirmLabel}</Text>
            <TextInput
              style={s.input}
              placeholder={Strings.teamDeletion.confirmPlaceholder}
              placeholderTextColor={t.color.textSecondary}
              value={d.typedName}
              onChangeText={d.setTypedName}
              autoCapitalize="none"
            />
            {!!d.error && (
              <View style={s.detailsMessage(true)}>
                <Text style={s.detailsMessageText(true)}>{d.error}</Text>
              </View>
            )}
            <View style={s.detailsButtonsRow}>
              <TouchableOpacity accessibilityRole="button" style={dangerButton(d.canConfirm && !d.isDeleting)} onPress={d.confirm} disabled={!d.canConfirm || d.isDeleting}>
                {d.isDeleting ? <ActivityIndicator size="small" color={t.color.surface} /> : (
                  <Text style={[rnText(t.type.bodyStrong), { color: t.color.surface }]}>{Strings.teamDeletion.confirmButton}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={s.secondaryButton} onPress={d.cancel} disabled={d.isDeleting}>
                <Text style={s.secondaryButtonText}>{Strings.teamDeletion.cancelButton}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
