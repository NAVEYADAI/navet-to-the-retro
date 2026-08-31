import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Field, Segmented, StatusDot, type Tone } from '@/components/ui';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  onSelectSprint: (sprint: any, team: any) => void;
}

type SprintState = 'active' | 'upcoming' | 'closed';
type Filter = 'all' | 'active' | 'closed';

const STATE_LABEL: Record<SprintState, string> = { active: 'פעיל', upcoming: 'עתידי', closed: 'סגור' };
const STATE_TONE: Record<SprintState, Tone> = { active: 'success', upcoming: 'warning', closed: 'neutral' };

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

export function TeamSprintsManagerWeb({ team, token, isAdmin, onSelectSprint }: TeamSprintsManagerProps) {
  const t = useTheme();

  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

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

  const withState = sprints.map((s) => ({ sprint: s, state: getSprintState(s.startDate, s.endDate) }));
  const open = withState.filter((s) => s.state !== 'closed');
  const closed = withState.filter((s) => s.state === 'closed');
  const visibleOpen = filter === 'closed' ? [] : open;
  const showClosedSection = filter !== 'active' && closed.length > 0;

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: `${t.space[5]}px`,
    paddingBlock: `${t.space[4]}px`,
    paddingInline: `${t.space[5]}px`,
    borderBottom: `1px solid ${t.color.border}`,
    cursor: 'pointer',
    transition: `background-color ${t.motion.fast}`,
    '&:hover': { backgroundColor: t.color.surfaceHover },
    '&:last-of-type': { borderBottom: 'none' },
  };

  return (
    <Box
      sx={{
        marginBlockStart: `${t.space[5]}px`,
        paddingBlockStart: `${t.space[5]}px`,
        borderBlockStart: `1px solid ${t.color.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${t.space[4]}px`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
        <Typography sx={{ ...t.type.cardTitle, color: t.color.text }}>{Strings.sprints.header}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2] + 2}px` }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'הכל' },
              { value: 'active', label: 'פעילים' },
              { value: 'closed', label: 'סגורים' },
            ]}
          />
          {isAdmin ? (
            <Button
              variant={showCreateForm ? 'ghost' : 'primary'}
              size="sm"
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? Strings.sprints.cancelButton : Strings.sprints.newSprintButton}
            </Button>
          ) : null}
        </Box>
      </Box>

      {showCreateForm && isAdmin ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${t.space[4]}px`,
            padding: `${t.space[5]}px`,
            border: `1px solid ${t.color.border}`,
            borderRadius: `${t.radius.card}px`,
            backgroundColor: t.color.surface,
          }}
        >
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>
            {Strings.sprints.createSprintHeader}
          </Typography>

          {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}

          <Field label="שם הספרינט" value={name} onChangeText={setName} placeholder={Strings.sprints.sprintNamePlaceholder} required />
          <Field label="תיאור" value={description} onChangeText={setDescription} placeholder={Strings.sprints.descriptionPlaceholder} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${t.space[4]}px` }}>
            <Field label={Strings.sprints.startDateLabel} value={startDate} onChangeText={setStartDate} type="date" required />
            <Field label={Strings.sprints.endDateLabel} value={endDate} onChangeText={setEndDate} type="date" required />
          </Box>

          <Box>
            <Button variant="primary" onPress={handleCreateSprint} disabled={isSubmitting} loading={isSubmitting}>
              פתח ספרינט רטרו
            </Button>
          </Box>
        </Box>
      ) : null}

      {isLoading ? (
        <CircularProgress size={24} sx={{ alignSelf: 'center', color: t.color.accent.base, marginBlock: `${t.space[4]}px` }} />
      ) : sprints.length === 0 ? (
        <Typography sx={{ ...t.type.body, color: t.color.textSecondary, textAlign: 'center', paddingBlock: `${t.space[4]}px` }}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </Typography>
      ) : (
        <Box
          sx={{
            border: `1px solid ${t.color.border}`,
            borderRadius: `${t.radius.card}px`,
            backgroundColor: t.color.surface,
            overflow: 'hidden',
          }}
        >
          {visibleOpen.map(({ sprint, state }) => (
            <Box key={sprint.id} onClick={() => onSelectSprint(sprint, team)} sx={rowSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[3]}px`, minWidth: 0 }}>
                <StatusDot tone={STATE_TONE[state]} />
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography sx={{ ...t.type.rowTitle, color: t.color.text }}>{sprint.name}</Typography>
                  {sprint.description ? (
                    <Typography sx={{ ...t.type.label, fontWeight: 400, color: t.color.textSecondary }}>
                      {sprint.description}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[5]}px`, flexShrink: 0 }}>
                <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                  <bdi>{new Date(sprint.startDate).toLocaleDateString()}</bdi>
                  {' — '}
                  <bdi>{new Date(sprint.endDate).toLocaleDateString()}</bdi>
                </Typography>
                <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                <Typography sx={{ ...t.type.label, fontFamily: t.type.overline.fontFamily, color: t.color.accent.base, minWidth: 60, textAlign: 'end' }}>
                  {Strings.sprints.enterRetroButton}
                </Typography>
              </Box>
            </Box>
          ))}

          {showClosedSection ? (
            <>
              <Box
                onClick={() => setIsExpiredExpanded(!isExpiredExpanded)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBlock: `${t.space[3]}px`,
                  paddingInline: `${t.space[5]}px`,
                  backgroundColor: t.color.surfaceSubtle,
                  borderBlockStart: `1px solid ${t.color.border}`,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <Typography sx={{ ...t.type.label, fontFamily: t.type.overline.fontFamily, color: t.color.textSecondary }}>
                  ספרינטים קודמים שנסגרו (<bdi>{closed.length}</bdi>)
                </Typography>
                <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                  {isExpiredExpanded ? 'הסתר' : 'הצג'}
                </Typography>
              </Box>

              {isExpiredExpanded
                ? closed.map(({ sprint, state }) => (
                    <Box key={sprint.id} onClick={() => onSelectSprint(sprint, team)} sx={rowSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[3]}px` }}>
                        <StatusDot tone={STATE_TONE[state]} />
                        <Typography sx={{ ...t.type.rowTitle, color: t.color.text }}>{sprint.name}</Typography>
                      </Box>
                      <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
                        <bdi>{new Date(sprint.startDate).toLocaleDateString()}</bdi>
                        {' — '}
                        <bdi>{new Date(sprint.endDate).toLocaleDateString()}</bdi>
                      </Typography>
                    </Box>
                  ))
                : null}
            </>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
