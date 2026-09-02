import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { sprintTone } from '@/design/tokens';
import { Icon } from '@/components/ui';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  onSelectSprint: (sprint: any, team: any) => void;
}

type SprintState = keyof typeof sprintTone;

const STATE_LABEL: Record<SprintState, string> = { active: 'פעיל', upcoming: 'עתידי', closed: 'סגור' };

function getSprintState(startDateStr: string, endDateStr: string): SprintState {
  const now = new Date();
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'closed';
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function TeamSprintsManagerNative({ team, token, isAdmin, onSelectSprint }: TeamSprintsManagerProps) {
  const t = useTheme();

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
        headers: { Authorization: `Bearer ${token}` },
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
      await fetchSprints();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בפתיחת ספרינט רטרו.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSprints = sprints.filter((s) => getSprintState(s.startDate, s.endDate) !== 'closed');
  const expiredSprints = sprints.filter((s) => getSprintState(s.startDate, s.endDate) === 'closed');

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

  function renderSprintCard(sprint: any, muted: boolean) {
    const state = getSprintState(sprint.startDate, sprint.endDate);
    const statusColor = t.color.status[sprintTone[state]];

    return (
      <View
        key={sprint.id}
        style={{
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: t.color.border,
          borderRadius: t.radius.card,
          padding: t.space[3],
          gap: t.space[1],
          opacity: muted ? 0.8 : 1,
        }}
      >
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[1] }}>
          <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, flexShrink: 1 }]}>{sprint.name}</Text>
          <View
            style={{
              backgroundColor: statusColor.bg,
              paddingHorizontal: t.space[2],
              paddingVertical: t.space[1] / 2,
              borderRadius: t.radius.pill,
            }}
          >
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: statusColor.fg }]}>
              {STATE_LABEL[state]}
            </Text>
          </View>
        </View>

        {!!sprint.description && (
          <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
            {sprint.description}
          </Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: muted ? t.color.surfaceSubtle : t.color.accent.base,
            borderRadius: t.radius.field,
            paddingHorizontal: t.space[3],
            paddingVertical: t.space[1] + 2,
            alignSelf: 'flex-start',
            marginTop: t.space[1],
          }}
          onPress={() => onSelectSprint(sprint, team)}
        >
          <Text
            style={[
              rnText({ ...t.type.caption, fontWeight: 700 }),
              { color: muted ? t.color.text : t.color.accent.onBase },
            ]}
          >
            {Strings.sprints.enterRetroButton}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.accent.base }]}>
                {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[1], paddingVertical: t.space[1] }}
            onPress={fetchSprints}
            disabled={isLoading}
          >
            <Icon name="refresh" size="sm" tone="muted" />
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.textSecondary }]}>
              {Strings.common.refreshButton}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right', flexShrink: 1 }]}>
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
      ) : activeSprints.length === 0 && expiredSprints.length === 0 ? (
        <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </Text>
      ) : (
        <View style={{ gap: t.space[2] }}>
          {activeSprints.map((sprint) => renderSprintCard(sprint, false))}

          {expiredSprints.length > 0 && (
            <View style={{ marginTop: t.space[2] }}>
              <TouchableOpacity
                testID="toggle-expired-sprints"
                onPress={() => setIsExpiredExpanded(!isExpiredExpanded)}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] + 2, paddingVertical: t.space[1] }}
              >
                <Icon name="chevron-down" size="sm" tone="muted" rotate={isExpiredExpanded ? 180 : 0} />
                <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.textSecondary }]}>
                  {`ספרינטים קודמים שנסגרו (${expiredSprints.length})`}
                </Text>
              </TouchableOpacity>

              {isExpiredExpanded && (
                <View style={{ gap: t.space[2], marginTop: t.space[2] }}>
                  {expiredSprints.map((sprint) => renderSprintCard(sprint, true))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
