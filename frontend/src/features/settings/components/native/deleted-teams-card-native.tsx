import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { trackEvent } from '@/lib/analytics';
import { useDeletedTeams } from '../../hooks/use-deleted-teams';
import { CardNative, ButtonNative, MessageNative, rnText } from './settings-native-parts';

/** גרסת native של "צוותים שנמחקו" (פיצ'ר 14, §14.2) — אותו hook, תצוגה ב-React Native. */
export function DeletedTeamsCardNative() {
  const t = useTheme();
  const { token } = useAuth();
  const d = useDeletedTeams(token);

  return (
    <CardNative title={Strings.deletedTeams.cardTitle} subtitle={Strings.deletedTeams.cardSubtitle}>
      <ButtonNative
        onPress={() => { trackEvent('refresh_clicked', { screen: 'deleted_teams' }); void d.load(); }}
        disabled={d.isLoading}
      >
        {Strings.common.refreshButton}
      </ButtonNative>

      {!!d.error && <MessageNative text={d.error} isError />}

      {d.isLoading ? (
        <ActivityIndicator size="small" color={t.color.textMuted} />
      ) : d.items.length === 0 ? (
        !d.error && <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right' }]}>{Strings.deletedTeams.empty}</Text>
      ) : (
        <View testID="deleted-teams" style={{ gap: t.space[2] }}>
          {d.items.map((team) => (
            <View
              key={team.id}
              testID="deleted-team-row"
              style={{ gap: t.space[2], paddingVertical: t.space[2], borderBottomWidth: 1, borderBottomColor: t.color.border }}
            >
              <View>
                <Text style={[rnText(t.type.rowTitle), { color: t.color.text, textAlign: 'right' }]}>{team.name}</Text>
                <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                  {[team.mainOffice, Strings.deletedTeams.sprintCount(team.sprintCount), Strings.deletedTeams.daysLeft(team.daysLeft)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <ButtonNative
                onPress={() => d.restore(team)}
                disabled={d.restoringId !== null}
                loading={d.restoringId === team.id}
              >
                {Strings.deletedTeams.restoreButton}
              </ButtonNative>
            </View>
          ))}
        </View>
      )}
    </CardNative>
  );
}
