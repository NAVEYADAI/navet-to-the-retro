import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';

interface CreateTeamFormProps {
  onSubmit: (name: string, mainOffice: string) => Promise<void>;
  isLoading: boolean;
  isFirstTeam?: boolean;
  onCancel?: () => void;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function CreateTeamForm({ onSubmit, isLoading, isFirstTeam = false, onCancel, theme }: CreateTeamFormProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newMainOffice, setNewMainOffice] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newTeamName.trim()) {
      setLocalError('שם הצוות שדה חובה.');
      return;
    }
    try {
      await onSubmit(newTeamName, newMainOffice);
      setNewTeamName('');
      setNewMainOffice('');
    } catch (err: any) {
      setLocalError(err.message || 'יצירת הצוות נכשלה.');
    }
  };

  return (
    <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.headerRow}>
        <ThemedText type="subtitle" style={styles.sectionHeader}>
          {isFirstTeam ? Strings.dashboard.createFirstTeamTitle : Strings.dashboard.createTeamTitle}
        </ThemedText>
        {!!onCancel && (
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.backgroundSelected }]} onPress={onCancel}>
            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
              {Strings.dashboard.closeButton}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {isFirstTeam && (
        <ThemedText type="default" style={styles.sectionDescription}>
          {Strings.dashboard.createFirstTeamDesc}
        </ThemedText>
      )}

      {!!localError && (
        <View style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{localError}</ThemedText>
        </View>
      )}

      <View style={styles.form}>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}
          placeholder="שם הצוות (למשל R&D Core)"
          placeholderTextColor={theme.textSecondary}
          value={newTeamName}
          onChangeText={setNewTeamName}
        />

        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}
          placeholder="משרד ראשי / מטה (אופציונלי)"
          placeholderTextColor={theme.textSecondary}
          value={newMainOffice}
          onChangeText={setNewMainOffice}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.text }]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: theme.background }]}>
              צור צוות (ראש צוות)
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sectionDescription: {
    opacity: 0.8,
    marginBottom: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    marginBottom: Spacing.one,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
});
