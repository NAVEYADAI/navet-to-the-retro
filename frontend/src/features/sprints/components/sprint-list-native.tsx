import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { sprintsNativeStyles } from '../styles/sprints.styles';

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

export function TeamSprintsManagerNative({ team, token, isAdmin, theme, onSelectSprint }: TeamSprintsManagerProps) {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);

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
      setError('שם, תאריך התחלה ותאריך סיום הם שדות חובה.');
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
      setError(err.response?.data?.message || err.message || 'שגיאה בפתיחת ספרינט רטרו.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSprintStatus = (startDateStr: string, endDateStr: string) => {
    const now = new Date();
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (now >= start && now <= end) {
      return { label: 'פעיל', color: '#2e7d32', bg: 'rgba(46, 125, 50, 0.08)', isExpired: false };
    } else if (now < start) {
      return { label: 'עתידי', color: '#ff8f00', bg: 'rgba(255, 143, 0, 0.08)', isExpired: false };
    } else {
      return { label: 'סגור', color: '#757575', bg: 'rgba(117, 117, 117, 0.08)', isExpired: true };
    }
  };

  const activeSprints = sprints.filter(s => !getSprintStatus(s.startDate, s.endDate).isExpired);
  const expiredSprints = sprints.filter(s => getSprintStatus(s.startDate, s.endDate).isExpired);

  return (
    <View style={sprintsNativeStyles.container}>
      <View style={sprintsNativeStyles.headerRow}>
        {isAdmin && (
          <TouchableOpacity
            style={[sprintsNativeStyles.toggleFormButton, { borderColor: theme.backgroundSelected }]}
            onPress={() => setShowCreateForm(!showCreateForm)}
          >
            <ThemedText style={{ fontSize: 12, color: '#007aff', fontWeight: 'bold' }}>
              {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
            </ThemedText>
          </TouchableOpacity>
        )}
        <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 15, textAlign: 'right' }}>
          {Strings.sprints.header}
        </ThemedText>
      </View>

      {showCreateForm && isAdmin && (
        <View style={[sprintsNativeStyles.createForm, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 13, textAlign: 'right' }}>
            {Strings.sprints.createSprintHeader}
          </ThemedText>

          {!!error && (
            <View style={sprintsNativeStyles.errorBanner}>
              <ThemedText style={sprintsNativeStyles.errorText}>{error}</ThemedText>
            </View>
          )}

          <TextInput
            style={[
              sprintsNativeStyles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={Strings.sprints.sprintNamePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            textAlign="right"
          />

          <TextInput
            style={[
              sprintsNativeStyles.input,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={Strings.sprints.descriptionPlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            textAlign="right"
          />

          <View style={sprintsNativeStyles.datesRow}>
            <TextInput
              style={[
                sprintsNativeStyles.input,
                sprintsNativeStyles.halfInput,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="תאריך התחלה"
              placeholderTextColor={theme.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />

            <TextInput
              style={[
                sprintsNativeStyles.input,
                sprintsNativeStyles.halfInput,
                {
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="תאריך סיום"
              placeholderTextColor={theme.textSecondary}
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[sprintsNativeStyles.submitButton, { backgroundColor: theme.text }]}
            onPress={handleCreateSprint}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <ThemedText style={{ fontWeight: 'bold', color: theme.background, fontSize: 13 }}>
                {Strings.sprints.openRetroButton}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={theme.text} />
      ) : activeSprints.length === 0 && expiredSprints.length === 0 ? (
        <ThemedText style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </ThemedText>
      ) : (
        <View style={sprintsNativeStyles.sprintsList}>
          {activeSprints.map((sprint) => {
            const status = getSprintStatus(sprint.startDate, sprint.endDate);

            return (
              <View
                key={sprint.id}
                style={[
                  sprintsNativeStyles.sprintCard,
                  { backgroundColor: theme.background, borderColor: theme.backgroundSelected }
                ]}
              >
                <View style={sprintsNativeStyles.sprintCardHeader}>
                  <ThemedText style={{ fontWeight: 'bold', fontSize: 14 }}>{sprint.name}</ThemedText>
                  <View style={[sprintsNativeStyles.statusBadge, { backgroundColor: status.bg }]}>
                    <ThemedText style={{ color: status.color, fontSize: 11, fontWeight: 'bold' }}>
                      {status.label}
                    </ThemedText>
                  </View>
                </View>

                {!!sprint.description && (
                  <ThemedText style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
                    {sprint.description}
                  </ThemedText>
                )}

                <TouchableOpacity
                  style={[sprintsNativeStyles.enterButton, { backgroundColor: theme.text }]}
                  onPress={() => onSelectSprint(sprint, team)}
                >
                  <ThemedText style={{ color: theme.background, fontSize: 12, fontWeight: 'bold' }}>
                    {Strings.sprints.enterRetroButton}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            );
          })}

          {expiredSprints.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                testID="toggle-expired-sprints"
                onPress={() => setIsExpiredExpanded(!isExpiredExpanded)}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 4 }}
              >
                <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.textSecondary }}>
                  {`${isExpiredExpanded ? '▼' : '◄'} ספרינטים קודמים שנסגרו (${expiredSprints.length})`}
                </ThemedText>
              </TouchableOpacity>

              {isExpiredExpanded && (
                <View style={[sprintsNativeStyles.sprintsList, { marginTop: 8 }]}>
                  {expiredSprints.map((sprint) => {
                    const status = getSprintStatus(sprint.startDate, sprint.endDate);

                    return (
                      <View
                        key={sprint.id}
                        style={[
                          sprintsNativeStyles.sprintCard,
                          { backgroundColor: theme.background, borderColor: theme.backgroundSelected, opacity: 0.8 }
                        ]}
                      >
                        <View style={sprintsNativeStyles.sprintCardHeader}>
                          <ThemedText style={{ fontWeight: 'bold', fontSize: 14 }}>{sprint.name}</ThemedText>
                          <View style={[sprintsNativeStyles.statusBadge, { backgroundColor: status.bg }]}>
                            <ThemedText style={{ color: status.color, fontSize: 11, fontWeight: 'bold' }}>
                              {status.label}
                            </ThemedText>
                          </View>
                        </View>

                        {!!sprint.description && (
                          <ThemedText style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
                            {sprint.description}
                          </ThemedText>
                        )}

                        <TouchableOpacity
                          style={[sprintsNativeStyles.enterButton, { backgroundColor: theme.backgroundSelected }]}
                          onPress={() => onSelectSprint(sprint, team)}
                        >
                          <ThemedText style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
                            {Strings.sprints.enterRetroButton}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
