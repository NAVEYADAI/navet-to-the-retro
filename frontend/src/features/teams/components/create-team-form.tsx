import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { getBackendUrl } from '@/api/config';
import { getTeamCreateErrorMessage } from '../team-create-error';

interface Approver {
  email: string;
  displayName: string | null;
}

interface CreateTeamFormProps {
  onSubmit: (name: string, mainOffice: string, approverEmail: string) => Promise<void>;
  isLoading: boolean;
  isFirstTeam?: boolean;
  onCancel?: () => void;
}

export function CreateTeamForm({ onSubmit, isLoading, isFirstTeam = false, onCancel }: CreateTeamFormProps) {
  const t = useTheme();
  const theme = {
    text: t.color.text,
    background: t.color.bg,
    backgroundElement: t.color.surface,
    backgroundSelected: t.color.surfaceSubtle,
    textSecondary: t.color.textSecondary,
  };
  const { user, token } = useAuth();
  const [newTeamName, setNewTeamName] = useState('');
  const [newMainOffice, setNewMainOffice] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approversLoading, setApproversLoading] = useState(true);
  const [approversError, setApproversError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchApprovers = async () => {
      setApproversLoading(true);
      setApproversError(null);
      try {
        const response = await axios.get(`${getBackendUrl()}/teams/allowed-approvers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setApprovers(response.data);
      } catch (err) {
        if (!cancelled) setApproversError(Strings.dashboard.approverListLoadError);
      } finally {
        if (!cancelled) setApproversLoading(false);
      }
    };

    fetchApprovers();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    setLocalError(null);
    if (!newTeamName.trim()) {
      setLocalError('שם הצוות שדה חובה.');
      return;
    }
    if (!approverEmail.trim()) {
      setLocalError(Strings.dashboard.approverEmailRequiredError);
      return;
    }
    try {
      await onSubmit(newTeamName, newMainOffice, approverEmail.trim());
      setNewTeamName('');
      setNewMainOffice('');
      setApproverEmail('');
    } catch (err: any) {
      // The single place a create-team failure is shown. Callers throw an Error with a ready Hebrew
      // message; a raw axios error (has `.response`) is mapped to a friendly one here (BUG-56).
      setLocalError(err?.response ? getTeamCreateErrorMessage(err) : (err?.message || Strings.dashboard.teamCreateFailedError));
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
        <View style={[styles.errorBanner, { backgroundColor: t.color.status.danger.bg, borderColor: t.color.status.danger.border }]}>
          <ThemedText style={[styles.errorText, { color: t.color.status.danger.fg }]}>{localError}</ThemedText>
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

        {!!user?.email && (
          <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>
            {Strings.dashboard.creatorEmailLabel(user.email)}
          </ThemedText>
        )}

        <ThemedText style={{ fontSize: 13, fontWeight: 'bold' }}>
          {Strings.dashboard.approverPickerLabel}
        </ThemedText>

        {approversLoading ? (
          <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>
            {Strings.dashboard.approverListLoading}
          </ThemedText>
        ) : approversError ? (
          <ThemedText style={{ fontSize: 12, color: t.color.status.danger.fg }}>
            {approversError}
          </ThemedText>
        ) : (
          <View style={styles.approverChipsRow}>
            {approvers.map((approver) => {
              const selected = approverEmail === approver.email;
              return (
                <TouchableOpacity
                  key={approver.email}
                  onPress={() => setApproverEmail(approver.email)}
                  style={[
                    styles.approverChip,
                    {
                      backgroundColor: selected ? theme.text : theme.backgroundSelected,
                      borderColor: selected ? theme.text : theme.backgroundSelected,
                    },
                  ]}
                >
                  <ThemedText style={{ fontSize: 13, fontWeight: selected ? 'bold' : 'normal', color: selected ? theme.background : theme.text }}>
                    {approver.displayName || approver.email}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>
          {Strings.dashboard.approverEmailHint}
        </ThemedText>

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
  approverChipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  approverChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
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
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: Spacing.one,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
