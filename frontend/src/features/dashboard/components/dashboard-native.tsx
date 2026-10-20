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
import { MyFocusTasksCard } from '@/features/focus-points';
import { GuideMenu, OnboardingSection } from '@/features/onboarding';
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
import { GuideAnchor } from '@/components/ui/guide-anchor';

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
  // כל כרטיס מדווח כמה ספרינטים פעילים יש לו אחרי שטען אותם — לשורת הסיכום מתחת לכותרת.
  const [activeByTeam, setActiveByTeam] = useState<Record<number, number>>({});
  // פיצ'ר 20/21: כפתור הרענון מושך מחדש גם את "המשימות שלי" ואת הצ'קליסט / "מה חדש".
  const [myTasksRefreshKey, setMyTasksRefreshKey] = useState(0);

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

  const activeCounts = teams.map((team) => activeByTeam[team.id]).filter((n): n is number => n !== undefined);
  const headerSummary = teams.length === 0
    ? ''
    : [
        Strings.dashboard.teamsCount(teams.length),
        activeCounts.length > 0 ? Strings.teamList.summaryActiveSprints(activeCounts.reduce((a, b) => a + b, 0)) : null,
      ].filter(Boolean).join(' · ');

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
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3], marginVertical: t.space[2] }}>
              <View style={{ flex: 1, minWidth: 0, gap: t.space[1] }}>
                <Text style={[rnText(t.type.pageTitle), { color: t.color.text, textAlign: 'right' }]}>
                  {Strings.teamList.myTeamsHeader}
                </Text>
                {!!headerSummary && (
                  <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{headerSummary}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1], flexShrink: 0 }}>
                <GuideMenu />
                {/* בטלפון רענון הוא אייקון בלבד — הטקסט נשאר כתווית נגישות. */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={Strings.common.refreshButton}
                  style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => { trackEvent('refresh_clicked', { screen: 'dashboard' }); refresh(); setMyTasksRefreshKey((k) => k + 1); }}
                  disabled={isLoadingTeams || isRefreshing}
                >
                  <Icon name="refresh" size="sm" tone="muted" />
                </TouchableOpacity>
                {teams.length > 0 && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={Strings.dashboard.newTeamButton}
                    accessibilityState={{ expanded: showCreateTeam }}
                    style={{
                      width: t.layout.minTouchTarget,
                      height: t.layout.minTouchTarget,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: t.radius.field,
                      borderWidth: 1,
                      borderColor: t.color.borderStrong,
                      backgroundColor: t.color.surface,
                    }}
                    onPress={() => { trackEvent('new_team_clicked', { screen: 'dashboard' }); setShowCreateTeam(!showCreateTeam); }}
                  >
                    <Icon name="plus" size="sm" />
                  </TouchableOpacity>
                )}
              </View>
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

            <OnboardingSection token={token} refreshKey={myTasksRefreshKey} teams={teams} userId={user.id} />

            <MyFocusTasksCard token={token} refreshKey={myTasksRefreshKey} />

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
                <GuideAnchor name="create-team-form">
                  <CreateTeamForm
                    onSubmit={handleCreateTeamSubmit}
                    isLoading={teamCreateLoading}
                    isFirstTeam={true}
                  />
                </GuideAnchor>
              </View>
            ) : (
              <View style={{ width: '100%', gap: t.space[4] }}>
                {showCreateTeam && (
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
                )}

                <TeamList
                  teams={teams}
                  token={token || ''}
                  userId={user.id}
                  onAddMemberSuccess={() => token && fetchMyTeams(token)}
                  onSelectSprint={(sprint, team) => openSprint(team.id, sprint.id)}
                  onActiveSprintCount={(teamId, count) =>
                    setActiveByTeam((prev) => (prev[teamId] === count ? prev : { ...prev, [teamId]: count }))
                  }
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
