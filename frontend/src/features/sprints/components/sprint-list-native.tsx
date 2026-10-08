import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { validateSprintDates, getSprintApiErrorMessage } from '../sprint-validation';
import { getSprintBucket } from '../sprint-lifecycle';
import { OpenSprintRow, RecentSprintsGroup, ExpiredSprintsGroup } from './sprint-rows-native';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  onSelectSprint: (sprint: any, team: any) => void;
  /** נקרא אחרי כל טעינה מוצלחת, כדי שכרטיס הצוות יוכל לספור ספרינטים פעילים בשורת הסיכום. */
  onSprintsLoaded?: (sprints: any[]) => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function TeamSprintsManagerNative({ team, token, isAdmin, onSelectSprint, onSprintsLoaded }: TeamSprintsManagerProps) {
  const t = useTheme();

  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // BUG-34: a failed load must not look like "no sprints yet".
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSprints = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/${team.id}/sprints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSprints(response.data);
      onSprintsLoaded?.(response.data);
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
      setLoadError(Strings.sprints.loadError);
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
      setError(Strings.sprints.requiredFieldsError);
      return;
    }
    const rangeError = validateSprintDates(startDate, endDate);
    if (rangeError) {
      setError(rangeError);
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(
        `${getBackendUrl()}/teams/${team.id}/sprints`,
        { name, description: description || undefined, startDate, endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowCreateForm(false);
      trackEvent('sprint_created');
      await fetchSprints();
    } catch (err: any) {
      setError(getSprintApiErrorMessage(err, Strings.sprints.createSprintErrorText));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSprints = sprints
    .map((sprint) => ({ sprint, bucket: getSprintBucket(sprint.startDate, sprint.endDate) }))
    .filter((s): s is { sprint: any; bucket: 'active' | 'upcoming' } => s.bucket === 'active' || s.bucket === 'upcoming');
  const recentSprints = sprints.filter((s) => getSprintBucket(s.startDate, s.endDate) === 'recent');
  const expiredSprints = sprints.filter((s) => getSprintBucket(s.startDate, s.endDate) === 'expired');

  const inputStyle: TextStyle = {
    ...rnText(t.type.body),
    height: t.layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: t.radius.field,
    paddingHorizontal: t.space[2],
    textAlign: 'right',
    color: t.color.text,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
  };

  return (
    <View
      style={{ gap: t.space[2] }}
    >
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2] }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
          {isAdmin && (
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: t.color.border,
                borderRadius: t.radius.badge,
                paddingHorizontal: t.space[2],
                paddingVertical: t.space[1],
              }}
              onPress={() => {
                trackEvent('sprint_create_form_toggled', { open: !showCreateForm });
                setShowCreateForm(!showCreateForm);
              }}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.accent.base }]}>
                {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
              </Text>
            </TouchableOpacity>
          )}
          {/* בטלפון רענון הוא אייקון בלבד — הטקסט נשאר כתווית נגישות. */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={Strings.common.refreshButton}
            style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => { trackEvent('refresh_clicked', { screen: 'sprint_list' }); fetchSprints(); }}
            disabled={isLoading}
          >
            <Icon name="refresh" size="sm" tone="muted" />
          </TouchableOpacity>
        </View>
        <Text style={[rnText(t.type.overline), { color: t.color.textMuted, textAlign: 'right', flexShrink: 1 }]}>
          {Strings.sprints.header}
        </Text>
      </View>

      {showCreateForm && isAdmin && (
        <View
          style={{
            padding: t.space[3],
            borderRadius: t.radius.card,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            gap: t.space[2],
            marginVertical: t.space[1],
          }}
        >
          <Text style={[rnText(t.type.label), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.sprints.createSprintHeader}
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
            placeholder={Strings.sprints.sprintNamePlaceholder}
            placeholderTextColor={t.color.textSecondary}
            value={name}
            onChangeText={setName}
            textAlign="right"
          />

          <TextInput
            style={inputStyle}
            placeholder={Strings.sprints.descriptionPlaceholder}
            placeholderTextColor={t.color.textSecondary}
            value={description}
            onChangeText={setDescription}
            textAlign="right"
          />

          <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              placeholder={Strings.sprints.startDateLabel}
              placeholderTextColor={t.color.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
              textAlign="right"
            />

            <TextInput
              style={[inputStyle, { flex: 1 }]}
              placeholder={Strings.sprints.endDateLabel}
              placeholderTextColor={t.color.textSecondary}
              value={endDate}
              onChangeText={setEndDate}
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: t.color.accent.base,
              borderRadius: t.radius.field,
              height: t.layout.minTouchTarget,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleCreateSprint}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={t.color.accent.onBase} size="small" />
            ) : (
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.accent.onBase }]}>
                {Strings.sprints.openRetroButton}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator size="small" color={t.color.accent.base} />
      ) : loadError ? (
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
            {loadError}
          </Text>
        </View>
      ) : activeSprints.length === 0 && recentSprints.length === 0 && expiredSprints.length === 0 ? (
        <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </Text>
      ) : (
        <View>
          {activeSprints.map(({ sprint, bucket }) => (
            <OpenSprintRow key={sprint.id} sprint={sprint} state={bucket} onPress={() => onSelectSprint(sprint, team)} />
          ))}

          {recentSprints.length > 0 && (
            <RecentSprintsGroup sprints={recentSprints} onSelect={(sprint) => onSelectSprint(sprint, team)} />
          )}

          {expiredSprints.length > 0 && (
            <ExpiredSprintsGroup sprints={expiredSprints} onSelect={(sprint) => onSelectSprint(sprint, team)} />
          )}
        </View>
      )}
    </View>
  );
}
