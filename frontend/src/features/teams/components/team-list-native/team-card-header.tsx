import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Avatar, Icon } from '@/components/ui';
import { memberDisplayName } from '@/features/teams/member-display';
import { rnText } from './team-settings-panel.styles';

// הכפתור יושב לצד השם, אז מספיקים שני אווטרים — שיישאר לשם מקום.
const MAX_STACKED_AVATARS = 2;

interface TeamCardHeaderProps {
  teamName: string;
  isTeamAdmin: boolean;
  summary: string;
  members: any[];
  isMembersOpen: boolean;
  onToggleMembers: () => void;
  /** undefined = אין הרשאה להגדרות, אז גלגל השיניים לא מוצג. */
  onToggleSettings?: () => void;
  isSettingsOpen: boolean;
}

/** ראש כרטיס הצוות בשורה אחת: שם + תג מנהל + שורת סיכום מימין, כפתור החברים וגלגל ההגדרות משמאל. */
export function TeamCardHeader({
  teamName,
  isTeamAdmin,
  summary,
  members,
  isMembersOpen,
  onToggleMembers,
  onToggleSettings,
  isSettingsOpen,
}: TeamCardHeaderProps) {
  const t = useTheme();

  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: t.space[4], paddingHorizontal: t.space[4], gap: t.space[2] }}>
      <View style={{ flex: 1, minWidth: 0, gap: t.space[1] }}>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: t.space[2] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>{teamName}</Text>
          {isTeamAdmin && (
            <View style={{ backgroundColor: t.color.accent.subtle, borderWidth: 1, borderColor: t.color.accent.border, borderRadius: t.radius.badge, paddingHorizontal: t.space[2], paddingVertical: 2 }}>
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.accent.base }]}>{Strings.teamList.adminBadge}</Text>
            </View>
          )}
        </View>
        {!!summary && <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{summary}</Text>}
      </View>

      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1], flexShrink: 0 }}>
        <TouchableOpacity
          testID="toggle-team-members"
          accessibilityRole="button"
          accessibilityLabel={Strings.teamList.membersToggleLabel(members.length)}
          accessibilityState={{ expanded: isMembersOpen }}
          onPress={onToggleMembers}
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 6,
            minHeight: t.layout.minTouchTarget,
            paddingRight: t.space[2],
            paddingLeft: 10,
            backgroundColor: isMembersOpen ? t.color.accent.subtle : t.color.surface,
            borderWidth: 1,
            borderColor: isMembersOpen ? t.color.accent.border : t.color.borderStrong,
            borderRadius: t.radius.pill,
          }}
        >
          {members.length > 0 && (
            <View style={{ flexDirection: 'row-reverse' }}>
              {members.slice(0, MAX_STACKED_AVATARS).map((m) => (
                <View key={m.id} style={{ marginLeft: -6 }}>
                  <Avatar name={memberDisplayName(m)} seed={m.id} size="sm" />
                </View>
              ))}
            </View>
          )}
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, marginRight: 4 }]} numberOfLines={1}>
            {Strings.teamList.membersToggleLabel(members.length)}
          </Text>
          <Icon name="chevron-down" size="sm" rotate={isMembersOpen ? 180 : 0} />
        </TouchableOpacity>

        {onToggleSettings && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={Strings.teamSettingsPanel.title}
            accessibilityState={{ expanded: isSettingsOpen }}
            onPress={onToggleSettings}
            style={{
              width: t.layout.minTouchTarget,
              height: t.layout.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radius.field,
              borderWidth: 1,
              borderColor: isSettingsOpen ? t.color.accent.border : 'transparent',
              backgroundColor: isSettingsOpen ? t.color.accent.subtle : 'transparent',
            }}
          >
            <Icon name="settings" size="md" tone={isSettingsOpen ? 'accent' : 'muted'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
