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

  // Local copy of the sprint's own editable fields — kept separate from the `sprint` prop so a
  // successful edit reflects immediately without waiting for the parent to refetch and pass a
  // new prop down. Resynced whenever a genuinely different sprint is selected (see effect below).
  const [sprintData, setSprintData] = useState(sprint);
  const [isEditingSprint, setIsEditingSprint] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
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
        isAnonymous
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setCategory('');
      setIsAnonymous(false);
      await fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בשליחת ההערה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleType = () => {
    setType(prev => prev === 'KEEP' ? 'IMPROVE' : 'KEEP');
  };

  const matchesFilters = (c: any) =>
    (filterCategories.length === 0 || filterCategories.includes(c.category)) &&
    (!filterText.trim() || c.content?.toLowerCase().includes(filterText.trim().toLowerCase())) &&
    (!highlightedOnly || c.isHighlighted);

  // Only team admins and team leads may highlight — see PRODUCT-BACKLOG.md §2.0.
  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const canHighlight = !!myMembership && (myMembership.isAdmin || myMembership.role === 'TEAM_LEADER');

  const handleToggleHighlight = async (commentId: number, nextValue: boolean) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, isHighlighted: nextValue } : c));
    try {
      await axios.patch(`${getBackendUrl()}/comments/${commentId}/highlight`, { isHighlighted: nextValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  // The team's creator OR any team admin can export a sprint summary — see PRODUCT-BACKLOG.md §1.0.
  const canExportSummary = team.creatorId === user.id || !!myMembership?.isAdmin;
  // Same permission as creating a sprint in the first place (sprints.service.ts::create) — no
  // one should be able to edit a sprint they couldn't have created.
  const canEditSprint = !!myMembership?.isAdmin;

  const startEditingSprint = () => {
    setEditName(sprintData.name);
    setEditDescription(sprintData.description || '');
    setEditStartDate(new Date(sprintData.startDate).toISOString().slice(0, 10));
    setEditEndDate(new Date(sprintData.endDate).toISOString().slice(0, 10));
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
        { name: editName.trim(), description: editDescription || undefined, startDate: editStartDate, endDate: editEndDate },
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
              <Button variant="ghost" size="sm" icon="refresh" onPress={fetchComments} disabled={isLoading}>
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

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: `${t.space[4]}px`, alignItems: { xs: 'stretch', sm: 'flex-end' } }}>
          <Box sx={{ minWidth: 200 }}>
            <Field
              type="select"
              label={Strings.retroBoard.categoryLabel}
              value={category}
              onChangeText={setCategory}
              options={categoryOptions}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
            <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>
              {Strings.retroBoard.anonymousToggleHint}
            </Typography>
            <Segmented
              value={isAnonymous ? 'anonymous' : 'identified'}
              onChange={(v) => setIsAnonymous(v === 'anonymous')}
              options={[
                { value: 'identified', label: Strings.retroBoard.identifiedToggleLabel },
                { value: 'anonymous', label: Strings.retroBoard.anonymousToggleLabel },
              ]}
            />
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
          onHighlightedOnlyChange={setHighlightedOnly}
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
