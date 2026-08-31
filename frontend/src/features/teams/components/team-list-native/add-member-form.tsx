import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { ROLES } from '@/constants/roles';

interface AddMemberFormProps {
  teamId: number;
  token: string;
  onInviteSent: () => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function AddMemberForm({ teamId, token, onInviteSent }: AddMemberFormProps) {
  const t = useTheme();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('DEVELOPER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddMember = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('נא למלא שם משתמש.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/teams/${teamId}/members`, {
        username: trimmed,
        role
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setUsername('');
      setRole('DEVELOPER');
      // A response with an `email` field means the person isn't registered yet — an invite
      // email was sent instead of creating a pending membership (see TeamsService.addMember).
      if (response.data?.email) {
        setSuccessMessage(Strings.teamList.emailInviteSentText(response.data.email));
      } else {
        onInviteSent();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בהוספת חבר צוות.');
    } finally {
      setIsLoading(false);
    }
  };

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
        הזמנת חבר צוות חדש
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
      {!!successMessage && (
        <Text style={[rnText(t.type.caption), { color: t.color.status.success.fg, textAlign: 'right' }]}>
          {successMessage}
        </Text>
      )}

      <TextInput
        style={[
          rnText(t.type.body),
          {
            height: t.layout.minTouchTarget,
            borderWidth: 1,
            borderRadius: t.radius.field,
            paddingHorizontal: t.space[2],
            textAlign: 'right',
            color: t.color.text,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
          },
        ]}
        placeholder={Strings.teamList.addMemberPlaceholder}
        placeholderTextColor={t.color.textSecondary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
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
        onPress={handleAddMember}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={t.color.accent.onBase} />
        ) : (
          <>
            <Icon name="user-plus" size="sm" tone="inverse" />
            <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
              {Strings.teamList.addMemberButton}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
