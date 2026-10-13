import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { ROLES } from '@/constants/roles';
import { rnText } from './team-settings-panel.styles';

interface MemberRoleEditorProps {
  role: string;
  onRoleChange: (role: string) => void;
  isAdmin: boolean;
  onIsAdminChange: (isAdmin: boolean) => void;
  isMe: boolean;
}

/** Role pills + admin switch inside a member row's manage area (admins only). Split out of team-member-row. */
export function MemberRoleEditor({ role, onRoleChange, isAdmin, onIsAdminChange, isMe }: MemberRoleEditorProps) {
  const t = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
        {ROLES.map((r) => {
          const selected = role === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              accessibilityState={{ selected }}
              onPress={() => onRoleChange(r.value)}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: t.space[1],
                paddingHorizontal: t.space[3],
                paddingVertical: t.space[1] + 3,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: selected ? t.color.accent.border : t.color.border,
                backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
              }}
            >
              <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
              <Text style={[rnText({ ...t.type.caption, fontWeight: selected ? 700 : 500 }), { color: selected ? t.color.accent.base : t.color.textSecondary }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
        <Text style={[rnText(t.type.body), { color: t.color.text, flexShrink: 1 }]}>{Strings.teamList.teamAdminPrivileges}</Text>
        <Switch
          value={isAdmin}
          onValueChange={onIsAdminChange}
          disabled={isMe}
          trackColor={{ false: t.color.border, true: t.color.accent.border }}
          thumbColor={isAdmin ? t.color.accent.base : t.color.surface}
        />
      </View>
    </>
  );
}
