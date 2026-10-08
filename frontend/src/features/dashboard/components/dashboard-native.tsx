import React, { useState } from 'react';
import axios from 'axios';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreateTeamForm, TeamList } from '@/features/teams';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useAuth } from '@/context/auth-context';
import { getBackendUrl } from '@/api/config';
import { getTeamCreateErrorMessage } from '@/features/teams/team-create-error';
import { Icon } from '@/components/ui';
import { useTeamsData } from '../hooks/use-teams-data';
import { openSprint } from '@/lib/sprint-routes';
import { trackEvent } from '@/lib/analytics';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function DashboardNative() {
  const t = useTheme();
  const { user, token } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const { teams, isLoadingTeams, isRefreshing, loadError, fetchMyTeams, refresh } = useTeamsData(token);

  const handleCreateTeamSubmit = async (name: string, mainOffice: string, approverEmail: string) => {
    setTeamCreateLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams`, {
        name: name,
        mainOffice: mainOffice,
        approverEmail: approverEmail,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      setShowCreateTeam(false);
      if (token) {
        await fetchMyTeams(token);
      }
    } catch (err: any) {
      // Shown once, inline, by CreateTeamForm (BUG-56) — not duplicated in a dashboard banner.
      throw new Error(getTeamCreateErrorMessage(err));
    } finally {
      setTeamCreateLoading(false);
    }
  };

  if (!user) return null;

  return (
    <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'row', backgroundColor: t.color.bg }}>
      <SafeAreaView style={{ flex: 1, maxWidth: MaxContentWidth, width: '100%' }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingBottom: BottomTabInset + t.space[4],
            paddingTop: isDesktop ? 80 : 100,
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', gap: t.space[4] }}>
            <View style={{ gap: t.space[1], alignItems: 'center', marginVertical: t.space[2] }}>
              <Text style={[rnText(t.type.pageTitle), { color: t.color.text, textAlign: 'center' }]}>
                {Strings.dashboard.welcomeTitle(user.firstName || user.username)}
              </Text>
              <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'center' }]}>
                {Strings.dashboard.welcomeSubtitle}
              </Text>
              <TouchableOpacity
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
                onPress={() => { trackEvent('refresh_clicked', { screen: 'dashboard' }); refresh(); }}
                disabled={isLoadingTeams || isRefreshing}
              >
                <Icon name="refresh" size="sm" tone="muted" />
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.textSecondary }]}>
                  {Strings.common.refreshButton}
                </Text>
              </TouchableOpacity>
            </View>

            {!!loadError && (
              <View
                style={{
                  backgroundColor: t.color.status.danger.bg,
                  borderWidth: 1,
                  borderColor: t.color.status.danger.border,
                  borderRadius: t.radius.field,
                  padding: t.space[2],
                  alignSelf: 'center',
                  width: '100%',
                  maxWidth: 480,
                }}
              >
                <Text style={[rnText(t.type.body), { color: t.color.status.danger.fg, textAlign: 'center' }]}>
                  {loadError}
                </Text>
              </View>
            )}

            {isLoadingTeams ? (
              <View style={{ padding: t.space[4], alignItems: 'center', gap: t.space[2] }}>
                <ActivityIndicator size="large" color={t.color.text} />
                <Text style={rnText(t.type.body)}>{Strings.dashboard.loadingTeams}</Text>
              </View>
            ) : loadError && teams.length === 0 ? null : teams.length === 0 ? (
              <View
                style={{
                  width: '100%',
                  maxWidth: 480,
                  padding: t.space[4],
                  borderRadius: t.radius.card,
                  borderWidth: 1,
                  alignSelf: 'center',
                  backgroundColor: t.color.surface,
                  borderColor: t.color.border,
                }}
              >
                <CreateTeamForm
                  onSubmit={handleCreateTeamSubmit}
                  isLoading={teamCreateLoading}
                  isFirstTeam={true}
                />
              </View>
            ) : (
              <View style={{ width: '100%', gap: t.space[4] }}>
                {showCreateTeam ? (
                  <View
                    style={{
                      padding: t.space[4],
                      borderRadius: t.radius.card,
                      borderWidth: 1,
                      width: '100%',
                      backgroundColor: t.color.surface,
                      borderColor: t.color.border,
                    }}
                  >
                    <CreateTeamForm
                      onSubmit={handleCreateTeamSubmit}
                      isLoading={teamCreateLoading}
                      isFirstTeam={false}
                      onCancel={() => setShowCreateTeam(false)}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{
                      padding: t.space[4],
                      borderRadius: t.radius.card,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      backgroundColor: t.color.surfaceSubtle,
                      borderColor: t.color.border,
                    }}
                    onPress={() => setShowCreateTeam(true)}
                  >
                    <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.text }]}>
                      {Strings.dashboard.createNewTeamButton}
                    </Text>
                  </TouchableOpacity>
                )}

                <TeamList
                          teams={teams}
                  token={token || ''}
                  userId={user.id}
                  onAddMemberSuccess={() => token && fetchMyTeams(token)}
                  onSelectSprint={(sprint, team) => openSprint(team.id, sprint.id)}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
