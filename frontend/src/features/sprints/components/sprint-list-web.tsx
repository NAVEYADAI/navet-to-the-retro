import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, CircularProgress, Alert, Menu, MenuItem } from '@mui/material';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { validateSprintDateRange } from '../sprint-validation';
import { getSprintBucket } from '../sprint-lifecycle';
import { OpenSprintRow, RecentSprintsGroup, ExpiredSprintsGroup } from './sprint-rows-web';

interface TeamSprintsManagerProps {
  team: any;
  token: string;
  isAdmin: boolean;
  onSelectSprint: (sprint: any, team: any) => void;
  /** נקרא אחרי כל טעינה מוצלחת, כדי שכרטיס הצוות יוכל לספור ספרינטים פעילים בשורת הסיכום. */
  onSprintsLoaded?: (sprints: any[]) => void;
}

type Filter = 'all' | 'active' | 'closed';
const FILTERS: Filter[] = ['all', 'active', 'closed'];

/** כפתור סינון קומפקטי (במקום שלושת הכפתורים) — כשמסונן הוא מסומן ומציג את שם הסינון. */
function SprintFilterButton({ value, onChange }: { value: Filter; onChange: (value: Filter) => void }) {
  const t = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isFiltered = value !== 'all';
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={Strings.sprints.filterButtonLabel}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e: React.MouseEvent<HTMLElement>) => {
          trackEvent('sprint_filter_opened');
          setAnchor(e.currentTarget);
        }}
        sx={{
          ...t.type.label,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${t.space[1]}px`,
          minWidth: t.layout.minTouchTarget,
          height: t.layout.minTouchTarget,
          paddingInline: isFiltered ? `${t.space[3]}px` : 0,
          color: isFiltered ? t.color.accent.base : t.color.textSecondary,
          backgroundColor: isFiltered ? t.color.accent.subtle : 'transparent',
          border: `1px solid ${isFiltered ? t.color.accent.border : 'transparent'}`,
          borderRadius: `${t.radius.field}px`,
          cursor: 'pointer',
          transition: `background-color ${t.motion.fast}`,
          '&:hover': { backgroundColor: isFiltered ? t.color.accent.subtle : t.color.surfaceSubtle },
        }}
      >
        <Icon name="filter" size="sm" tone={isFiltered ? 'accent' : 'muted'} />
        {isFiltered && Strings.sprints.filterOptions[value]}
      </Box>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {FILTERS.map((option) => (
          <MenuItem
            key={option}
            selected={option === value}
            onClick={() => {
              trackEvent('sprint_filter_changed', { filter: option });
              onChange(option);
              setAnchor(null);
            }}
            sx={{ ...t.type.body, gap: `${t.space[2]}px`, minHeight: t.layout.minTouchTarget, minWidth: 140 }}
          >
            <Box sx={{ display: 'inline-flex', width: 16, visibility: option === value ? 'visible' : 'hidden' }}>
              <Icon name="check" size="sm" tone="accent" />
            </Box>
            {Strings.sprints.filterOptions[option]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function TeamSprintsManagerWeb({ team, token, isAdmin, onSelectSprint, onSprintsLoaded }: TeamSprintsManagerProps) {
  const t = useTheme();

  const [sprints, setSprints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // BUG-34: a failed load must not look like "no sprints yet" — it gets its own error state.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFilter, setFilter] = useState<Filter>('all');

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
      setError('שם, תאריך התחלה ותאריך סיום הם שדות חובה.');
      return;
    }
    const rangeError = validateSprintDateRange(startDate, endDate);
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
      setError(err.response?.data?.message || err.message || 'שגיאה בפתיחת ספרינט רטרו.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const withBucket = sprints.map((s) => ({ sprint: s, bucket: getSprintBucket(s.startDate, s.endDate) }));
  const open = withBucket
    .filter((s) => s.bucket === 'active' || s.bucket === 'upcoming')
    .map(({ sprint, bucket }) => ({ sprint, state: bucket as 'active' | 'upcoming' }));
  const recent = withBucket.filter((s) => s.bucket === 'recent').map(({ sprint }) => sprint);
  const expired = withBucket.filter((s) => s.bucket === 'expired').map(({ sprint }) => sprint);
  // הסינון רלוונטי רק כשיש יותר מספרינט אחד בתצוגה (בלי ה"ספרינטים שהסתיימו" המקופלים).
  const canFilter = open.length + recent.length > 1;
  const filter: Filter = canFilter ? selectedFilter : 'all';
  // BUG-58: "פעילים" means sprints that are running now — upcoming ones appear under "הכל" only.
  const visibleOpen = filter === 'closed' ? [] : filter === 'active' ? open.filter((s) => s.state === 'active') : open;
  const showRecentSection = filter !== 'active' && recent.length > 0;
  const showExpiredSection = filter !== 'active' && expired.length > 0;
  const hasNothingToShow = visibleOpen.length === 0 && !showRecentSection && !showExpiredSection;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
        <Typography sx={{ ...t.type.overline, color: t.color.textMuted, textTransform: 'uppercase', minWidth: 0 }}>{Strings.sprints.header}</Typography>
        {/*
          `marginInlineStart: 'auto'` (לא רק ה-`justifyContent:'space-between'` של ההורה) — כי
          כש-flexWrap שובר לשתי שורות במובייל, האשכול הזה נופל לשורה משלו לבד, וב-justify-content
          עם פריט יחיד בשורה אין "בין מה למה" לפזר, אז הוא נדבק לתחילת הכיוון (ימין ב-RTL) במקום
          להישאר בצד שמאל כמו בדסקטופ. margin אוטומטי בצד ההתחלה דוחף אותו לקצה הנגדי בכל מצב.
        */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2] + 2}px`, marginInlineStart: 'auto' }}>
          {canFilter && !loadError ? <SprintFilterButton value={filter} onChange={setFilter} /> : null}
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            iconOnlyOnMobile
            onPress={() => { trackEvent('refresh_clicked', { screen: 'sprint_list' }); fetchSprints(); }}
            disabled={isLoading}
          >
            {Strings.common.refreshButton}
          </Button>
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

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: `${t.space[4]}px` }}>
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
      ) : loadError ? (
        <Alert severity="error" sx={{ ...t.type.body }}>{loadError}</Alert>
      ) : sprints.length === 0 ? (
        <Typography sx={{ ...t.type.body, color: t.color.textSecondary, textAlign: 'center', paddingBlock: `${t.space[4]}px` }}>
          {isAdmin ? Strings.sprints.noSprintsTextAdmin : Strings.sprints.noSprintsTextMember}
        </Typography>
      ) : (
        <Box>
          {hasNothingToShow ? (
            <Typography sx={{ ...t.type.body, color: t.color.textSecondary, textAlign: 'center', paddingBlock: `${t.space[4]}px` }}>
              {Strings.sprints.noSprintsInFilterText}
            </Typography>
          ) : null}

          {visibleOpen.map(({ sprint, state }) => (
            <OpenSprintRow key={sprint.id} sprint={sprint} state={state} onPress={() => onSelectSprint(sprint, team)} />
          ))}

          {showRecentSection ? <RecentSprintsGroup sprints={recent} onSelect={(sprint) => onSelectSprint(sprint, team)} /> : null}

          {showExpiredSection ? <ExpiredSprintsGroup sprints={expired} onSelect={(sprint) => onSelectSprint(sprint, team)} /> : null}
        </Box>
      )}
    </Box>
  );
}
