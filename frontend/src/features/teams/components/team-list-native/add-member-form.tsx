import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { nativeStyles } from './styles';
import { roles } from './roles';
import type { TeamListTheme } from '@/features/teams/types';

interface AddMemberFormProps {
  teamId: number;
  token: string;
  onInviteSent: () => void;
  theme: TeamListTheme;
}

export function AddMemberForm({ teamId, token, onInviteSent, theme }: AddMemberFormProps) {
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
    <View style={nativeStyles.addMemberSection}>
      <ThemedText type="default" style={{ fontWeight: 'bold', textAlign: 'right' }}>
        הזמנת חבר צוות חדש
      </ThemedText>

      {!!error && (
        <View style={nativeStyles.errorBannerInline}>
          <ThemedText style={nativeStyles.errorTextInline}>{error}</ThemedText>
        </View>
      )}
      {!!successMessage && (
        <ThemedText style={{ fontSize: 12, color: '#2e7d32', textAlign: 'right' }}>
          {successMessage}
        </ThemedText>
      )}

      <TextInput
        style={[
          nativeStyles.input,
          {
            color: theme.text,
            borderColor: theme.backgroundSelected,
            backgroundColor: theme.background,
          },
        ]}
        placeholder={Strings.teamList.addMemberPlaceholder}
        placeholderTextColor={theme.textSecondary}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
        {roles.map((r) => {
          const selected = role === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              style={[
                nativeStyles.roleOptionBtn,
                { backgroundColor: selected ? theme.backgroundSelected : theme.background }
              ]}
              onPress={() => setRole(r.value)}
            >
              <ThemedText style={{ fontSize: 11, fontWeight: selected ? 'bold' : 'normal' }}>
                {r.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[nativeStyles.button, { backgroundColor: theme.text }]}
        onPress={handleAddMember}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <ThemedText style={[nativeStyles.buttonText, { color: theme.background }]}>
            {Strings.teamList.addMemberButton}
          </ThemedText>
        )}
      </TouchableOpacity>
    </View>
  );
}
