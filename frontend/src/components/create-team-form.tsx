import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

interface CreateTeamFormProps {
  onSubmit: (name: string, mainOffice: string) => Promise<void>;
  isLoading: boolean;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function CreateTeamForm({ onSubmit, isLoading, theme }: CreateTeamFormProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newMainOffice, setNewMainOffice] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newTeamName.trim()) {
      setLocalError('Team name is required.');
      return;
    }
    try {
      await onSubmit(newTeamName, newMainOffice);
      setNewTeamName('');
      setNewMainOffice('');
    } catch (err: any) {
      setLocalError(err.message || 'Failed to create team.');
    }
  };

  return (
    <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="subtitle" style={styles.sectionHeader}>
        Create your first development team
      </ThemedText>
      <ThemedText type="default" style={styles.sectionDescription}>
        You don't belong to any development team yet. Create one below to start collecting retro notes.
      </ThemedText>

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
          placeholder="Team Name (e.g. R&D Core)"
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
          placeholder="Main Office / Headquarters (Optional)"
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
              Create Team (Team Leader)
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
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
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
