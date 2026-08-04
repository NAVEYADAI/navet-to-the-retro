import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import axios from 'axios';
import { TextField } from '@mui/material';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
  onSelectSprint: (sprint: any, team: any) => void;
}

export function TeamSprintsManager({ team, token, isAdmin, theme, onSelectSprint }: TeamSprintsManagerProps) {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states for creating sprint
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  const fetchSprints = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSprints(response.data);
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, [team.id]);

  const handleCreateSprint = async () => {
    setError(null);
    if (!name.trim() || !startDate.trim() || !endDate.trim()) {
      setError('Name, Start Date, and End Date are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        name,
        description: description || undefined,
        startDate,
        endDate
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowCreateForm(false);
      await fetchSprints();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 16 }}>
          Sprint Retrospectives
        </ThemedText>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.toggleFormButton, { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>
              {showCreateForm ? 'Cancel' : '+ New Sprint'}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Create Sprint form for Admins */}
      {showCreateForm && isAdmin && (
        <View style={[styles.createForm, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14 }}>
            Create New Retro Session
          </ThemedText>

          {!!error && (
            <View style={styles.errorBanner}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder="Sprint Name (e.g. Sprint 1)"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
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
            placeholder="Description (Optional)"
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
          />

          {Platform.OS === 'web' ? (
            <View style={styles.datesRowWeb}>
              <TextField
                type="date"
                label="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
                sx={{
                  flex: 1,
                  input: { color: theme.text },
                  label: { color: theme.textSecondary },
                  fieldset: { borderColor: theme.backgroundSelected },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.background,
                    '&:hover fieldset': {
                      borderColor: theme.text,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.text,
                    },
                  }
                }}
              />

              <TextField
                type="date"
                label="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
                sx={{
                  flex: 1,
                  input: { color: theme.text },
                  label: { color: theme.textSecondary },
                  fieldset: { borderColor: theme.backgroundSelected },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.background,
                    '&:hover fieldset': {
                      borderColor: theme.text,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.text,
                    },
                  }
                }}
              />
            </View>
          ) : (
            <View style={styles.datesRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.background,
                  },
                ]}
                placeholder="Start Date (YYYY-MM-DD)"
                placeholderTextColor={theme.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
              />

              <TextInput
                style={[
                  styles.input,
                  styles.halfInput,
                  {
                    color: theme.text,
                    borderColor: theme.backgroundSelected,
                    backgroundColor: theme.background,
                  },
                ]}
                placeholder="End Date (YYYY-MM-DD)"
                placeholderTextColor={theme.textSecondary}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.text }]}
            onPress={handleCreateSprint}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <ThemedText style={{ fontWeight: 'bold', color: theme.background, fontSize: 13 }}>
                Open Sprint Retro
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Sprints list */}
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.text} style={{ marginVertical: Spacing.two }} />
      ) : sprints.length === 0 ? (
        <ThemedText type="default" style={styles.noSprintsText}>
          No sprints created yet. {isAdmin ? 'Use the "+ New Sprint" button to create one!' : 'Wait for an admin to open a retro session.'}
        </ThemedText>
      ) : (
        <View style={styles.sprintsList}>
          {sprints.map((sprint) => (
            <TouchableOpacity
              key={sprint.id}
              style={[styles.sprintCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
              onPress={() => onSelectSprint(sprint, team)}
            >
              <View style={styles.sprintInfo}>
                <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14 }}>
                  {sprint.name}
                </ThemedText>
                {sprint.description && (
                  <ThemedText type="default" style={{ fontSize: 12, opacity: 0.8 }}>
                    {sprint.description}
                  </ThemedText>
                )}
                <ThemedText type="code" style={{ fontSize: 11, opacity: 0.7 }}>
                  {`${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
                </ThemedText>
              </View>
              <View style={[styles.enterBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: theme.text }}>
                  Enter Retro →
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleFormButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  createForm: {
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    fontSize: 13,
  },
  datesRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  datesRowWeb: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: 4,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  noSprintsText: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
    marginVertical: Spacing.one,
    fontStyle: 'italic',
  },
  sprintsList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  sprintCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
  },
  sprintInfo: {
    gap: 2,
    flex: 1,
  },
  enterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.one,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 12,
    textAlign: 'center',
  },
});
