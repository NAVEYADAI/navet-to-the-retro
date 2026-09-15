import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { ROLES } from '@/constants/roles';
import { trackEvent } from '@/lib/analytics';

interface AddPhantomMemberFormProps {
  teamId: number;
  token: string;
  onCreated: () => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2) — same pattern as the
// native AddMemberForm, but for a real person who refuses to register: first/last name instead
// of username, no invite email sent, `POST /teams/:teamId/phantom-members` creates the phantom
// TeamMember directly.
export function AddPhantomMemberForm({ teamId, token, onCreated }: AddPhantomMemberFormProps) {
  const t = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      setError(Strings.teamList.phantomFirstNameRequiredError);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/phantom-members`, {
        firstName: trimmedFirstName,
        lastName: lastName.trim() || undefined,
        role
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setFirstName('');
      setLastName('');
      setRole('DEVELOPER');
      trackEvent('phantom_member_created');
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.teamList.phantomMemberCreateError);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = [
    rnText(t.type.body),
    {
      height: t.layout.minTouchTarget,
      borderWidth: 1,
      borderRadius: t.radius.field,
      paddingHorizontal: t.space[2],
      textAlign: 'right' as const,
      color: t.color.text,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
    },
  ];

  return (
    <View
      style={{
        gap: t.space[2],
        marginTop: t.space[2],
        paddingTop: t.space[2],
        borderTopWidth: 1,
        borderTopColor: t.color.border,
      }}
    >
      <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>
        {Strings.teamList.addPhantomMemberHeader}
      </Text>

      {!!error && (
        <View
          style={{
            backgroundColor: t.color.status.danger.bg,
            borderWidth: 1,
            borderColor: t.color.status.danger.border,
            borderRadius: t.radius.field,
            padding: t.space[2],
          }}
        >
          <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
            {error}
          </Text>
        </View>
      )}

      <TextInput
        style={inputStyle}
        placeholder={Strings.teamList.phantomFirstNameLabel}
        placeholderTextColor={t.color.textSecondary}
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={inputStyle}
        placeholder={Strings.teamList.phantomLastNamePlaceholder}
        placeholderTextColor={t.color.textSecondary}
        value={lastName}
        onChangeText={setLastName}
      />

      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[1] + 2, marginVertical: t.space[1] }}>
        {ROLES.map((r) => {
          const selected = role === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: t.space[1],
                paddingHorizontal: t.space[3],
                paddingVertical: t.space[1] + 3,
                borderRadius: t.radius.pill,
                borderWidth: 1.5,
                borderColor: selected ? t.color.accent.base : t.color.border,
                backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
              }}
              onPress={() => setRole(r.value)}
            >
              <Icon name={r.icon} size="sm" tone={selected ? 'accent' : 'muted'} />
              <Text style={[rnText({ ...t.type.caption, fontWeight: selected ? 700 : 500 }), { color: selected ? t.color.accent.base : t.color.textSecondary }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={{
          flexDirection: 'row-reverse',
          gap: t.space[1],
          backgroundColor: t.color.accent.base,
          borderRadius: t.radius.field,
          minHeight: t.layout.minTouchTarget,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: t.space[1],
        }}
        onPress={handleCreate}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={t.color.accent.onBase} />
        ) : (
          <>
            <Icon name="user-plus" size="sm" tone="inverse" />
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
              {Strings.teamList.addPhantomMemberButton}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
