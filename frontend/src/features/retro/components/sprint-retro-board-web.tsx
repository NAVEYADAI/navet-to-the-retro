import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Page, PageHeader, Grid, Card, Button, Field, Segmented, Icon } from '@/components/ui';
import { CommentCardWeb } from './comment-card-web';
import { RetroWheelToggle } from './retro-wheel-toggle';
import { CommentFilterBarWeb } from './comment-filter-bar-web';
import { SprintSummary } from '@/features/sprint-summary';
import { MemoryBoard } from './memory-board';
import { SprintLengthHistoryPanelWeb } from './sprint-length-history-panel-web';
import { trackEvent } from '@/lib/analytics';

interface SprintRetroBoardWebProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  onBack: () => void;
}

export function SprintRetroBoardWeb({ sprint, team, token, user, onBack }: SprintRetroBoardWebProps) {
  const t = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [showMemoryBoard, setShowMemoryBoard] = useState(false);

  // Local copy of the sprint's own editable fields — kept separate from the `sprint` prop so a
  // successful edit reflects immediately without waiting for the parent to refetch and pass a
  // new prop down. Resynced whenever a genuinely different sprint is selected (see effect below).
  const [sprintData, setSprintData] = useState(sprint);
  const [isEditingSprint, setIsEditingSprint] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  // Feature 5 (product-backlog/05-sprint-length-audit-log.md §5.2): optional free-text reason,
  // sent as `reason` in the PATCH body and persisted onto the SprintLengthChange row the backend
  // creates only when startDate/endDate actually change — irrelevant otherwise, so always reset
  // to empty on each fresh edit rather than carried over from a previous edit session.
  const [editReason, setEditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setSprintData(sprint);
    setIsEditingSprint(false);
  }, [sprint.id]);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [category, setCategory] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2): '' means "post as
  // me" (the default) — any other value is the target TeamMember's userId, sent as
  // onBehalfOfUserId. Never both this AND isAnonymous — see the render guard below.
  const [onBehalfOfUserId, setOnBehalfOfUserId] = useState('');
  const [isBehalfPickerOpen, setIsBehalfPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment list filters (distinct from the compose-form state above)
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [highlightedOnly, setHighlightedOnly] = useState(false);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [sprint.id]);

  const handlePostComment = async () => {
    setError(null);
    if (!content.trim()) {
      setError('תוכן ההערה אינו יכול להיות ריק.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        content: content.trim(),
        type,
        category: category || undefined,
        isAnonymous: onBehalfOfUserId ? false : isAnonymous,
        onBehalfOfUserId: onBehalfOfUserId ? Number(onBehalfOfUserId) : undefined
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setCategory('');
      setIsAnonymous(false);
      trackEvent('retro_comment_added', { type });
      if (onBehalfOfUserId) {
        trackEvent('retro_comment_posted_on_behalf', { type });
      }
      setOnBehalfOfUserId('');
      await fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בשליחת ההערה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleType = () => {
    const next = type === 'KEEP' ? 'IMPROVE' : 'KEEP';
    setType(next);
    trackEvent('retro_wheel_toggled', { type: next });
  };

  const matchesFilters = (c: any) =>
    (filterCategories.length === 0 || filterCategories.includes(c.category)) &&
    (!filterText.trim() || c.content?.toLowerCase().includes(filterText.trim().toLowerCase())) &&
    (!highlightedOnly || c.isHighlighted);

  // Only team admins and team leads may highlight — see product-backlog/02-comment-highlighting.md §2.0.
  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const canHighlight = !!myMembership && (myMembership.isAdmin || myMembership.role === 'TEAM_LEADER');
  // Same predicate as canHighlight — mirrors the backend's assertCanManageTeamContent guard on
  // GET .../length-history (product-backlog/05-sprint-length-audit-log.md §5.2): admin or
  // TEAM_LEADER only, a regular team member never even sees the button/panel.
  const canViewLengthHistory = canHighlight;
  // Same guard as canHighlight — Feature 9 (phantom members) §9.0 decision #1: posting "on
  // behalf of" someone (a phantom or a real member) is an admin/team-leader-only action.
  const canPostOnBehalf = canHighlight;
  const behalfCandidates = (team.members || [])
    .filter((m: any) => m.userId !== user.id && m.status !== 'PENDING')
    .map((m: any) => ({
      value: String(m.userId),
      label: m.user?.firstName || m.user?.lastName
        ? `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim()
        : (m.user?.username || ''),
      isPhantom: m.user?.isPhantom === true,
    }));
  const postOnBehalfOptions = [
    { value: '', label: Strings.retroBoard.postOnBehalfMeOption },
    ...behalfCandidates,
  ];
  const selectedBehalfLabel = behalfCandidates.find((m: any) => m.value === onBehalfOfUserId)?.label;

  const handleToggleHighlight = async (commentId: number, nextValue: boolean) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, isHighlighted: nextValue } : c));
    try {
      await axios.patch(`${getBackendUrl()}/comments/${commentId}/highlight`, { isHighlighted: nextValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      trackEvent('retro_comment_highlighted', { isHighlighted: nextValue });
    } catch (err) {
      console.error('Failed to update highlight:', err);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, isHighlighted: !nextValue } : c));
    }
  };

  const keepComments = comments.filter(c => c.type === 'KEEP' && matchesFilters(c));
  const improveComments = comments.filter(c => c.type === 'IMPROVE' && matchesFilters(c));
  const isFilterActive = filterCategories.length > 0 || !!filterText.trim();

  const categoryOptions = [
    { value: '', label: Strings.retroBoard.categoryNone },
    ...Object.entries(Strings.retroBoard.categories).map(([value, label]) => ({ value, label })),
  ];

  // The team's creator OR any team admin can export a sprint summary — see product-backlog/01-sprint-summary-export.md §1.0.
  const canExportSummary = team.creatorId === user.id || !!myMembership?.isAdmin;
  // Same permission as creating a sprint in the first place (sprints.service.ts::create) — no
  // one should be able to edit a sprint they couldn't have created.
  const canEditSprint = !!myMembership?.isAdmin;

  const startEditingSprint = () => {
    setEditName(sprintData.name);
    setEditDescription(sprintData.description || '');
    setEditStartDate(new Date(sprintData.startDate).toISOString().slice(0, 10));
    setEditEndDate(new Date(sprintData.endDate).toISOString().slice(0, 10));
    setEditReason('');
    setEditError(null);
    setIsEditingSprint(true);
  };

  const handleSaveSprintEdit = async () => {
    setEditError(null);
    if (!editName.trim() || !editStartDate.trim() || !editEndDate.trim()) {
      setEditError('שם, תאריך התחלה ותאריך סיום הם שדות חובה.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const response = await axios.patch(
        `${getBackendUrl()}/teams/${team.id}/sprints/${sprintData.id}`,
        { name: editName.trim(), description: editDescription || undefined, startDate: editStartDate, endDate: editEndDate, reason: editReason.trim() || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSprintData(response.data);
      setIsEditingSprint(false);
    } catch (err: any) {
      setEditError(err.response?.data?.message || err.message || Strings.retroBoard.editSprintErrorText);
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (showSummary) {
    return <SprintSummary sprint={sprintData} team={team} token={token} onBack={() => setShowSummary(false)} />;
  }

  if (showMemoryBoard) {
    return <MemoryBoard sprint={sprintData} team={team} token={token} onBack={() => setShowMemoryBoard(false)} />;
  }

  return (
    <Page>
      <PageHeader
        title={sprintData.name}
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[3]}px` }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px` }}>
              {canEditSprint ? (
                <Button variant="ghost" size="sm" icon="edit" onPress={startEditingSprint}>
                  {Strings.retroBoard.editSprintButton}
                </Button>
              ) : null}
              {canExportSummary ? (
                <Button variant="ghost" size="sm" icon="presentation" onPress={() => setShowSummary(true)}>
                  {Strings.sprintSummary.openButton}
                </Button>
              ) : null}
              {/* Any team member can open — no isAdmin/role gate, see product-backlog/08-memory-board.md §8.0 decision #7. */}
              <Button
                variant="ghost"
                size="sm"
                icon="eye"
                onPress={() => { trackEvent('memory_board_opened', { sprintId: sprintData.id }); setShowMemoryBoard(true); }}
              >
                {Strings.memoryBoard.openButton}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onPress={() => { trackEvent('refresh_clicked', { screen: 'retro_board' }); fetchComments(); }}
                disabled={isLoading}
              >
                {Strings.common.refreshButton}
              </Button>
            </Box>
            <Button variant="ghost" size="sm" onPress={onBack}>{Strings.retroBoard.backButton}</Button>
          </Box>
        }
      />

      {isEditingSprint ? (
        <Card>
          <Typography sx={{ ...t.type.cardTitle, color: t.color.text }}>
            {Strings.retroBoard.editSprintHeader}
          </Typography>

          {editError && (
            <Alert severity="error" sx={{ ...t.type.body }}>
              {editError}
            </Alert>
          )}

          <Field label={Strings.sprints.sprintNamePlaceholder} placeholder={Strings.sprints.sprintNamePlaceholder} value={editName} onChangeText={setEditName} required />
          <Field label={Strings.sprints.descriptionPlaceholder} placeholder={Strings.sprints.descriptionPlaceholder} value={editDescription} onChangeText={setEditDescription} />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: `${t.space[4]}px` }}>
            <Field label={Strings.sprints.startDateLabel} placeholder={Strings.sprints.startDateLabel} value={editStartDate} onChangeText={setEditStartDate} type="date" required />
            <Field label={Strings.sprints.endDateLabel} placeholder={Strings.sprints.endDateLabel} value={editEndDate} onChangeText={setEditEndDate} type="date" required />
          </Box>

          <Field label={Strings.retroBoard.editReasonLabel} placeholder={Strings.retroBoard.editReasonPlaceholder} value={editReason} onChangeText={setEditReason} />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px`, justifyContent: 'flex-end' }}>
            <Button variant="primary" onPress={handleSaveSprintEdit} disabled={isSavingEdit} loading={isSavingEdit}>
              {Strings.teamList.saveButton}
            </Button>
            <Button variant="secondary" onPress={() => setIsEditingSprint(false)}>
              {Strings.teamList.cancelButton}
            </Button>
          </Box>
        </Card>
      ) : (
        <>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {team.name} •{' '}
            <bdi>
              {new Date(sprintData.startDate).toLocaleDateString()} - {new Date(sprintData.endDate).toLocaleDateString()}
            </bdi>
          </Typography>

          {sprintData.description && (
            <Typography sx={{ ...t.type.body, color: t.color.text, fontStyle: 'italic' }}>
              {sprintData.description}
            </Typography>
          )}
        </>
      )}

      {canViewLengthHistory && (
        <SprintLengthHistoryPanelWeb teamId={team.id} sprintId={sprintData.id} token={token} />
      )}

      {/* Compose form */}
      <Card>
        <Typography sx={{ ...t.type.cardTitle, color: t.color.text }}>
          {Strings.retroBoard.writeNoteHeader}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ ...t.type.body }}>
            {error}
          </Alert>
        )}

        <RetroWheelToggle type={type} toggleType={toggleType} />

        <Field
          type="textarea"
          label={type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
          value={content}
          onChangeText={setContent}
          placeholder={type === 'KEEP' ? Strings.retroBoard.notePlaceholderKeep : Strings.retroBoard.notePlaceholderImprove}
          rows={3}
        />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: `${t.space[4]}px`, alignItems: { xs: 'stretch', sm: 'flex-end' }, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 200 }}>
            <Field
              type="select"
              label={Strings.retroBoard.categoryLabel}
              value={category}
              onChangeText={setCategory}
              options={categoryOptions}
            />
          </Box>

          {/* Feature 9 §9.0 decision #2: "on behalf of" comments can never be anonymous — a
              single 3-way control instead of a plain dropdown next to a separate toggle, so the
              three identity states (me / anonymous / on behalf) read as one choice, not two
              disjoint widgets. Picking "on behalf" opens a small picker instead of committing
              immediately; the segment itself then shows who was picked, which doubles as the
              "you're not posting as yourself" indication before the comment is even sent. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px`, position: 'relative' }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>
              {Strings.retroBoard.anonymousToggleHint}
            </Typography>
            <Segmented
              value={onBehalfOfUserId ? 'onBehalf' : (isAnonymous ? 'anonymous' : 'identified')}
              onChange={(v) => {
                if (v === 'onBehalf') {
                  setIsBehalfPickerOpen((prev) => !prev);
                  return;
                }
                setIsBehalfPickerOpen(false);
                setOnBehalfOfUserId('');
                setIsAnonymous(v === 'anonymous');
              }}
              options={[
                { value: 'identified', label: Strings.retroBoard.identifiedToggleLabel, icon: 'eye' },
                { value: 'anonymous', label: Strings.retroBoard.anonymousToggleLabel, icon: 'eye-off' },
                ...(canPostOnBehalf
                  ? [{
                      value: 'onBehalf',
                      label: onBehalfOfUserId ? `${Strings.retroBoard.postOnBehalfLabel} ${selectedBehalfLabel}` : Strings.retroBoard.postOnBehalfOtherOption,
                      icon: 'ghost' as const,
                    }]
                  : []),
              ]}
            />

            {isBehalfPickerOpen && (
              <>
                <Box onClick={() => setIsBehalfPickerOpen(false)} sx={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    marginTop: '6px',
                    insetInlineEnd: 0,
                    zIndex: 11,
                    width: 220,
                    backgroundColor: t.color.surface,
                    border: `1px solid ${t.color.accent.border}`,
                    borderRadius: `${t.radius.field}px`,
                    boxShadow: t.shadow.md,
                    padding: '4px',
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}
                >
                  {behalfCandidates.map((m: any) => (
                    <Box
                      key={m.value}
                      onClick={() => {
                        setOnBehalfOfUserId(m.value);
                        setIsAnonymous(false);
                        setIsBehalfPickerOpen(false);
                        trackEvent('retro_comment_on_behalf_picker_selected');
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${t.space[2]}px`,
                        padding: '8px 10px',
                        borderRadius: `${t.radius.badge}px`,
                        cursor: 'pointer',
                        color: t.color.text,
                        ...t.type.body,
                        '&:hover': { backgroundColor: t.color.surfaceHover },
                      }}
                    >
                      {m.isPhantom && <Icon name="ghost" size="sm" tone="muted" />}
                      <bdi>{m.label}</bdi>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onPress={handlePostComment} disabled={isSubmitting} loading={isSubmitting}>
            {Strings.retroBoard.postNoteButton}
          </Button>
        </Box>
      </Card>

      {/* Filters */}
      {!isLoading && comments.length > 0 && (
        <CommentFilterBarWeb
          categories={filterCategories}
          onCategoriesChange={setFilterCategories}
          searchText={filterText}
          onSearchTextChange={setFilterText}
          highlightedOnly={highlightedOnly}
          onHighlightedOnlyChange={(value) => {
            setHighlightedOnly(value);
            trackEvent('retro_highlighted_filter_toggled', { value });
          }}
        />
      )}

      {/* Board columns */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBlock: `${t.space[7]}px` }}>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {Strings.retroBoard.loadingBoard}
          </Typography>
        </Box>
      ) : (
        <Grid columns={2}>
          {/* Column 1: KEEP */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: `${t.space[2]}px`,
                paddingBlock: `${t.space[2]}px`,
                borderRadius: `${t.radius.card}px`,
                backgroundColor: t.color.status.success.bg,
                border: `1px solid ${t.color.status.success.border}`,
              }}
            >
              <Icon name="check" tone="success" />
              <Typography sx={{ ...t.type.cardTitle, color: t.color.status.success.fg }}>
                {Strings.retroBoard.keepLabel}
              </Typography>
            </Box>

            {keepComments.length === 0 ? (
              <Typography sx={{ ...t.type.body, color: t.color.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>
                {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyKeepText}
              </Typography>
            ) : (
              keepComments.map((comment, index) => (
                <CommentCardWeb
                  key={comment.id}
                  comment={comment}
                  index={index}
                  canHighlight={canHighlight}
                  onToggleHighlight={handleToggleHighlight}
                />
              ))
            )}
          </Box>

          {/* Column 2: IMPROVE */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: `${t.space[2]}px`,
                paddingBlock: `${t.space[2]}px`,
                borderRadius: `${t.radius.card}px`,
                backgroundColor: t.color.status.danger.bg,
                border: `1px solid ${t.color.status.danger.border}`,
              }}
            >
              <Icon name="wrench" tone="danger" />
              <Typography sx={{ ...t.type.cardTitle, color: t.color.status.danger.fg }}>
                {Strings.retroBoard.improveLabel}
              </Typography>
            </Box>

            {improveComments.length === 0 ? (
              <Typography sx={{ ...t.type.body, color: t.color.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>
                {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyImproveText}
              </Typography>
            ) : (
              improveComments.map((comment, index) => (
                <CommentCardWeb
                  key={comment.id}
                  comment={comment}
                  index={index}
                  canHighlight={canHighlight}
                  onToggleHighlight={handleToggleHighlight}
                />
              ))
            )}
          </Box>
        </Grid>
      )}
    </Page>
  );
}
