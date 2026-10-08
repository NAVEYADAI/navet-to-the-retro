import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
  Animated,
  Modal,
  FlatList,
  type TextStyle,
} from 'react-native';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { LoadErrorNative } from '@/components/load-error-native';
import { CommentFilterBarNative } from './comment-filter-bar-native';
import { SprintLengthHistoryPanelNative } from './sprint-length-history-panel-native';
import { trackEvent } from '@/lib/analytics';
import { formatDate, formatTime, formatDateRange } from '@/lib/format-date';
import { validateSprintDateRange } from '@/features/sprints/sprint-validation';
import { getCommentCategoryLabel, getCommentAuthorName, getPostedByAdminLabel } from '../comment-display';

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  onBack: () => void;
  /** Summary and memory board are their own routes (BUG-33) — the screen owns navigation. */
  onOpenSummary: () => void;
  onOpenMemory: () => void;
}

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.2): the
// team's own categories (default + custom), fetched from GET /teams/:teamId/categories. Replaces
// the old static Strings.retroBoard.categories object as the runtime source of truth.
interface TeamCategory {
  id: number;
  teamId: number;
  label: string;
  isDefault: boolean;
  isEnabled: boolean;
  createdById: number | null;
  createdAt: string;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

function editFieldStyle(t: ReturnType<typeof useTheme>): TextStyle {
  return {
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
}

export function SprintRetroBoardNative({ sprint, team, token, user, onBack, onOpenSummary, onOpenMemory }: SprintRetroBoardProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // BUG-34: a failed comments load must not render as "no notes yet".
  const [loadError, setLoadError] = useState<string | null>(null);

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
  // '' means "no category" — otherwise the string form of a TeamCommentCategory id.
  const [categoryId, setCategoryId] = useState('');
  const [teamCategories, setTeamCategories] = useState<TeamCategory[]>([]);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.2): '' means "post as
  // me" (the default) — any other value is the target TeamMember's userId, sent as
  // onBehalfOfUserId. Never both this AND isAnonymous — see the render guard below.
  const [onBehalfOfUserId, setOnBehalfOfUserId] = useState('');
  const [isPostAsPickerOpen, setIsPostAsPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment list filters (distinct from the compose-form state above)
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [highlightedOnly, setHighlightedOnly] = useState(false);

  // Press-triggered scale feedback for the KEEP/IMPROVE toggle (no animation on mount/type-change).
  const [wheelScale] = useState(new Animated.Value(1));

  const fetchComments = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setLoadError(Strings.retroBoard.loadCommentsError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [sprint.id]);

  // Feature 3 §3.2: fetched once on mount (per this project's mount-only-fetch data-freshness
  // rule — no auto-refetch-on-focus) — not re-fetched after posting a comment, since the category
  // list itself doesn't change as a side effect of posting.
  useEffect(() => {
    const fetchTeamCategories = async () => {
      try {
        const response = await axios.get(`${getBackendUrl()}/teams/${team.id}/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTeamCategories(response.data);
      } catch (err) {
        console.error('Failed to fetch team categories:', err);
      }
    };
    fetchTeamCategories();
  }, [team.id, token]);

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
        categoryId: categoryId ? Number(categoryId) : undefined,
        isAnonymous: onBehalfOfUserId ? false : isAnonymous,
        onBehalfOfUserId: onBehalfOfUserId ? Number(onBehalfOfUserId) : undefined
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setCategoryId('');
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

  const handleWheelPressIn = () => {
    Animated.spring(wheelScale, { toValue: 0.92, useNativeDriver: Platform.OS !== 'web', speed: 40 }).start();
  };

  const handleWheelPressOut = () => {
    Animated.spring(wheelScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 40 }).start();
  };

  const matchesFilters = (c: any) =>
    (filterCategories.length === 0 || filterCategories.includes(String(c.categoryId))) &&
    (!filterText.trim() || c.content?.toLowerCase().includes(filterText.trim().toLowerCase())) &&
    (!highlightedOnly || c.isHighlighted);

  const keepComments = comments.filter(c => c.type === 'KEEP' && matchesFilters(c));
  const improveComments = comments.filter(c => c.type === 'IMPROVE' && matchesFilters(c));
  // BUG-54: the "highlighted only" toggle is a filter too.
  const isFilterActive = filterCategories.length > 0 || !!filterText.trim() || highlightedOnly;

  // Feature 3 §3.2: compose-form picker only offers enabled categories.
  const categoryOptions = teamCategories.filter((c) => c.isEnabled).map((c) => ({ value: String(c.id), label: c.label }));
  const selectedCategoryLabel = categoryOptions.find((o) => o.value === categoryId)?.label;

  // Feature 3 §3.2: the filter bar must ALSO include a disabled category if some already-loaded
  // comment is tagged with it — otherwise that comment becomes unfilterable the moment its
  // category gets disabled.
  const usedCategoryIds = new Set(comments.map((c) => c.categoryId).filter((id) => id != null));
  const filterCategoryOptions = teamCategories
    .filter((c) => c.isEnabled || usedCategoryIds.has(c.id))
    .map((c) => ({ value: String(c.id), label: c.label }));

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
  const postOnBehalfOptions: [string, string, boolean][] = [
    ['', Strings.retroBoard.postOnBehalfMeOption, false],
    ...((team.members || [])
      .filter((m: any) => m.userId !== user.id && m.status !== 'PENDING')
      .map((m: any): [string, string, boolean] => [
        String(m.userId),
        m.user?.firstName || m.user?.lastName
          ? `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim()
          : (m.user?.username || ''),
        m.user?.isPhantom === true,
      ])),
  ];
  const postOnBehalfSelectedLabel = postOnBehalfOptions.find(([value]) => value === onBehalfOfUserId)?.[1];

  const handleToggleHighlight = async (commentId: number, nextValue: boolean) => {
    setComments(prev => prev.map(c => (c.id === commentId ? { ...c, isHighlighted: nextValue } : c)));
    try {
      await axios.patch(`${getBackendUrl()}/comments/${commentId}/highlight`, { isHighlighted: nextValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      trackEvent('retro_comment_highlighted', { isHighlighted: nextValue });
    } catch (err) {
      console.error('Failed to update highlight:', err);
      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, isHighlighted: !nextValue } : c)));
    }
  };

  const isKeep = type === 'KEEP';
  const wheelTone = isKeep ? t.color.status.success : t.color.status.danger;

  const renderCommentCard = (comment: any, accent: { fg: string; bg: string; border: string }) => {
    const categoryLabel = getCommentCategoryLabel(comment);
    const isHighlighted = !!comment.isHighlighted;
    const authorName = getCommentAuthorName(comment);
    const postedByAdminLabel = getPostedByAdminLabel(comment);

    return (
      <View
        key={comment.id}
        style={{
          backgroundColor: isHighlighted ? t.color.accent.subtle : t.color.surface,
          borderWidth: isHighlighted ? 1 : 0,
          borderColor: t.color.accent.border,
          borderRightWidth: 3,
          borderRightColor: accent.fg,
          borderRadius: t.radius.card,
          padding: t.space[3],
          gap: t.space[2],
        }}
      >
        {(!!categoryLabel || canHighlight || isHighlighted) && (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] }}>
            {!!categoryLabel ? (
              <View
                style={{
                  backgroundColor: accent.bg,
                  borderRadius: t.radius.pill,
                  borderTopRightRadius: t.radius.badge,
                  paddingHorizontal: t.space[2],
                  paddingVertical: 3,
                }}
              >
                <Text style={[rnText(t.type.overline), { color: accent.fg }]}>{categoryLabel}</Text>
              </View>
            ) : (
              <View />
            )}

            {canHighlight ? (
              <TouchableOpacity
                onPress={() => handleToggleHighlight(comment.id, !isHighlighted)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon name="star" size="sm" tone={isHighlighted ? 'accent' : 'muted'} />
              </TouchableOpacity>
            ) : isHighlighted ? (
              <Icon name="star" size="sm" tone="accent" />
            ) : null}
          </View>
        )}
        {!!postedByAdminLabel && (
          <View
            style={{
              flexDirection: 'row-reverse',
              alignSelf: 'flex-end',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: t.radius.pill,
              backgroundColor: t.color.accent.subtle,
              borderWidth: 1,
              borderColor: t.color.accent.border,
            }}
          >
            <Icon name="ghost" size="sm" tone="accent" />
            <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.accent.base, textAlign: 'right' }]}>
              {postedByAdminLabel}
            </Text>
          </View>
        )}
        <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>
          {comment.content}
        </Text>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[1] }}>
          <Text style={[rnText({ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 700 }), { color: t.color.textSecondary, flexShrink: 1 }]}>
            {authorName}
          </Text>
          <Text style={[rnText(t.type.caption), { color: t.color.textMuted }]}>
            {`${formatDate(comment.createdAt)} · ${formatTime(comment.createdAt)}`}
          </Text>
        </View>
      </View>
    );
  };

  // The team's creator OR any team admin can export a sprint summary — see product-backlog/01-sprint-summary-export.md §1.0.
  const canExportSummary = team.creatorId === user.id || !!myMembership?.isAdmin;
  // Only team admins may edit a sprint's own settings — same guard as sprint creation.
  const canEditSprint = !!myMembership?.isAdmin;

  const startEditingSprint = () => {
    setEditError(null);
    setEditName(sprintData.name || '');
    setEditDescription(sprintData.description || '');
    setEditStartDate(new Date(sprintData.startDate).toISOString().slice(0, 10));
    setEditEndDate(new Date(sprintData.endDate).toISOString().slice(0, 10));
    setEditReason('');
    setIsEditingSprint(true);
  };

  const handleSaveSprintEdit = async () => {
    setEditError(null);
    // BUG-12: same client-side check as the web board; any other rejection (e.g. unparseable date)
    // comes back from the backend as a 400 whose message is shown below.
    const rangeError = validateSprintDateRange(editStartDate, editEndDate);
    if (rangeError) {
      setEditError(rangeError);
      return;
    }
    setIsSavingEdit(true);
    try {
      const response = await axios.patch(
        `${getBackendUrl()}/teams/${team.id}/sprints/${sprintData.id}`,
        {
          name: editName.trim(),
          description: editDescription.trim(),
          startDate: editStartDate,
          endDate: editEndDate,
          reason: editReason.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSprintData(response.data);
      setIsEditingSprint(false);
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      setEditError((Array.isArray(serverMessage) ? serverMessage.join(' ') : serverMessage) || Strings.retroBoard.editSprintErrorText);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ paddingTop: isDesktop ? 80 : 100, paddingBottom: t.space[6] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: t.space[4], gap: t.space[4], maxWidth: 1100, alignSelf: 'center', width: '100%' }}>
        {/* Header (RTL flow) */}
        <View
          style={{
            flexDirection: 'row-reverse',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: t.space[2],
            paddingBottom: t.space[3],
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
            {/* Sprint-level actions (edit + summary) grouped together, visually distinct from navigation. */}
            <View
              style={{
                flexDirection: 'row-reverse',
                gap: t.space[1],
                backgroundColor: t.color.surfaceSubtle,
                borderRadius: t.radius.field,
                padding: 2,
              }}
            >
              {canEditSprint && (
                <TouchableOpacity
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
                  onPress={startEditingSprint}
                >
                  <Icon name="edit" size="sm" tone="muted" />
                  <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                    {Strings.retroBoard.editSprintButton}
                  </Text>
                </TouchableOpacity>
              )}
              {canExportSummary && (
                <TouchableOpacity
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
                  onPress={() => { trackEvent('sprint_summary_opened', { sprintId: sprintData.id }); onOpenSummary(); }}
                >
                  <Icon name="presentation" size="sm" tone="muted" />
                  <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                    {Strings.sprintSummary.openButton}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Any team member can open — no isAdmin/role gate, see product-backlog/08-memory-board.md §8.0 decision #7. */}
              <TouchableOpacity
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
                onPress={() => { trackEvent('memory_board_opened', { sprintId: sprintData.id }); onOpenMemory(); }}
              >
                <Icon name="eye" size="sm" tone="muted" />
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                  {Strings.memoryBoard.openButton}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
                onPress={() => { trackEvent('refresh_clicked', { screen: 'retro_board' }); fetchComments(); }}
                disabled={isLoading}
              >
                <Icon name="refresh" size="sm" tone="muted" />
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                  {Strings.common.refreshButton}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
              onPress={onBack}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                {Strings.retroBoard.backButton}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingSprint ? (
            <View
              style={{
                gap: t.space[2],
                width: '100%',
                backgroundColor: t.color.surface,
                borderRadius: t.radius.card,
                borderWidth: 1,
                borderColor: t.color.border,
                padding: t.space[3],
              }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text, textAlign: 'right' }]}>
                {Strings.retroBoard.editSprintHeader}
              </Text>
              <TextInput
                style={editFieldStyle(t)}
                value={editName}
                onChangeText={setEditName}
                placeholder={Strings.sprints.sprintNamePlaceholder}
                placeholderTextColor={t.color.textSecondary}
              />
              <TextInput
                style={editFieldStyle(t)}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={Strings.sprints.descriptionPlaceholder}
                placeholderTextColor={t.color.textSecondary}
              />
              <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
                <TextInput
                  style={[editFieldStyle(t), { flex: 1 }]}
                  value={editStartDate}
                  onChangeText={setEditStartDate}
                  placeholder={Strings.sprints.startDateLabel}
                  placeholderTextColor={t.color.textSecondary}
                />
                <TextInput
                  style={[editFieldStyle(t), { flex: 1 }]}
                  value={editEndDate}
                  onChangeText={setEditEndDate}
                  placeholder={Strings.sprints.endDateLabel}
                  placeholderTextColor={t.color.textSecondary}
                />
              </View>
              <TextInput
                style={editFieldStyle(t)}
                value={editReason}
                onChangeText={setEditReason}
                placeholder={Strings.retroBoard.editReasonLabel}
                placeholderTextColor={t.color.textSecondary}
              />
              {!!editError && (
                <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
                  {editError}
                </Text>
              )}
              <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', paddingVertical: t.space[2], borderRadius: t.radius.field, backgroundColor: t.color.accent.base, opacity: isSavingEdit ? 0.6 : 1 }}
                  onPress={handleSaveSprintEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator color={t.color.accent.onBase} size="small" />
                  ) : (
                    <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.accent.onBase }]}>
                      {Strings.teamList.saveButton}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', paddingVertical: t.space[2], borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.border }}
                  onPress={() => setIsEditingSprint(false)}
                  disabled={isSavingEdit}
                >
                  <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                    {Strings.teamList.cancelButton}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 1 }}>
              <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>
                {sprintData.name}
              </Text>
              <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
                {`${team.name} • ${formatDateRange(sprintData.startDate, sprintData.endDate)}`}
              </Text>
              {!!sprintData.description && (
                <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
                  {sprintData.description}
                </Text>
              )}
            </View>
          )}
        </View>

        {canViewLengthHistory && (
          <SprintLengthHistoryPanelNative teamId={team.id} sprintId={sprintData.id} token={token} />
        )}

        {/* Main form for posting (RTL formatted) */}
        <View
          style={{
            backgroundColor: isAnonymous ? t.color.surfaceSubtle : t.color.surface,
            borderColor: isAnonymous ? t.color.accent.border : wheelTone.border,
            borderWidth: 2,
            borderRadius: t.radius.card,
            padding: t.space[4],
            gap: t.space[2],
          }}
        >
          <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.retroBoard.writeNoteHeader}
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
              <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'center' }]}>
                {error}
              </Text>
            </View>
          )}

          {/* KEEP / IMPROVE toggle */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: t.space[4], marginVertical: t.space[3] }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleType}
              onPressIn={handleWheelPressIn}
              onPressOut={handleWheelPressOut}
              accessibilityLabel={Strings.retroBoard.spinLabel}
            >
              <Animated.View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderWidth: 2,
                  borderColor: wheelTone.border,
                  backgroundColor: wheelTone.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: wheelScale }],
                }}
              >
                <Icon name={isKeep ? 'check' : 'wrench'} tone={isKeep ? 'success' : 'danger'} size="lg" />
              </Animated.View>
            </TouchableOpacity>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.textSecondary, marginBottom: 2, textAlign: 'right' }]}>
                {Strings.retroBoard.spinLabel}
              </Text>
              <Text testID="retro-type-label" style={[rnText({ ...t.type.cardTitle, fontWeight: 800 }), { color: wheelTone.fg, textAlign: 'right' }]}>
                {isKeep ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
              </Text>
            </View>
          </View>

          <TextInput
            style={[
              rnText(t.type.body),
              {
                height: 60,
                borderWidth: 1,
                borderRadius: t.radius.field,
                paddingHorizontal: t.space[2],
                paddingVertical: t.space[2],
                textAlign: 'right',
                textAlignVertical: 'top',
                color: t.color.text,
                borderColor: t.color.border,
                backgroundColor: t.color.bg,
              },
            ]}
            placeholder={isKeep ? Strings.retroBoard.notePlaceholderKeep : Strings.retroBoard.notePlaceholderImprove}
            placeholderTextColor={t.color.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={3}
          />

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2], alignSelf: 'flex-end' }}>
            {canPostOnBehalf && (
              <TouchableOpacity
                onPress={() => setIsPostAsPickerOpen(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: t.space[1] + 2,
                  paddingHorizontal: t.space[3] + 2,
                  borderRadius: t.radius.pill,
                  borderTopRightRadius: t.radius.badge,
                  backgroundColor: onBehalfOfUserId ? t.color.accent.subtle : t.color.surfaceSubtle,
                  borderWidth: onBehalfOfUserId ? 1 : 0,
                  borderColor: t.color.accent.border,
                }}
              >
                <Icon name="ghost" size="sm" tone={onBehalfOfUserId ? 'accent' : 'muted'} />
                <Text style={[rnText({ ...t.type.label, fontWeight: onBehalfOfUserId ? 700 : 400 }), { color: onBehalfOfUserId ? t.color.accent.base : t.color.textSecondary }]}>
                  {onBehalfOfUserId ? `${Strings.retroBoard.postOnBehalfLabel} ${postOnBehalfSelectedLabel}` : Strings.retroBoard.postOnBehalfOtherOption}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setIsCategoryPickerOpen(true)}
              activeOpacity={0.8}
              style={{
                paddingVertical: t.space[1] + 2,
                paddingHorizontal: t.space[3] + 2,
                borderRadius: t.radius.pill,
                borderTopRightRadius: t.radius.badge,
                backgroundColor: categoryId ? t.color.accent.subtle : t.color.surfaceSubtle,
              }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: categoryId ? 700 : 400 }), { color: categoryId ? t.color.accent.base : t.color.textSecondary }]}>
                {categoryId ? selectedCategoryLabel : Strings.retroBoard.categoryLabel}
              </Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={isPostAsPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsPostAsPickerOpen(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: t.color.overlay, justifyContent: 'flex-end' }}
              activeOpacity={1}
              onPress={() => setIsPostAsPickerOpen(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  backgroundColor: t.color.surface,
                  borderTopLeftRadius: t.radius.card + 8,
                  borderTopRightRadius: t.radius.card + 8,
                  maxHeight: '70%',
                  paddingVertical: t.space[2],
                }}
              >
                <FlatList
                  data={postOnBehalfOptions}
                  keyExtractor={([value]) => value || 'me'}
                  renderItem={({ item: [value, label, isPhantom] }) => (
                    <TouchableOpacity
                      onPress={() => { setOnBehalfOfUserId(value); setIsPostAsPickerOpen(false); }}
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: t.space[2],
                        paddingVertical: t.space[3] + 2,
                        paddingHorizontal: t.space[5],
                        backgroundColor: onBehalfOfUserId === value ? t.color.surfaceSubtle : 'transparent',
                      }}
                    >
                      {isPhantom && <Icon name="ghost" size="sm" tone="muted" />}
                      <Text style={[rnText({ ...t.type.body, fontWeight: onBehalfOfUserId === value ? 700 : 400 }), { color: t.color.text, textAlign: 'right' }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <Modal
            visible={isCategoryPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsCategoryPickerOpen(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: t.color.overlay, justifyContent: 'flex-end' }}
              activeOpacity={1}
              onPress={() => setIsCategoryPickerOpen(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{
                  backgroundColor: t.color.surface,
                  borderTopLeftRadius: t.radius.card + 8,
                  borderTopRightRadius: t.radius.card + 8,
                  maxHeight: '70%',
                  paddingVertical: t.space[2],
                }}
              >
                <FlatList
                  data={[['', Strings.retroBoard.categoryNone] as [string, string], ...categoryOptions.map((o) => [o.value, o.label] as [string, string])]}
                  keyExtractor={([key]) => key || 'none'}
                  renderItem={({ item: [key, label] }) => (
                    <TouchableOpacity
                      onPress={() => { setCategoryId(key); setIsCategoryPickerOpen(false); }}
                      style={{
                        paddingVertical: t.space[3] + 2,
                        paddingHorizontal: t.space[5],
                        backgroundColor: categoryId === key ? t.color.surfaceSubtle : 'transparent',
                      }}
                    >
                      <Text style={[rnText({ ...t.type.body, fontWeight: categoryId === key ? 700 : 400 }), { color: t.color.text, textAlign: 'right' }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[2], marginTop: t.space[1] }}>
            {/* Feature 9 §9.0 decision #2: "on behalf of" comments can never be anonymous — the
                UI doesn't even offer the choice once a target other than "me" is selected, on
                top of the server-side enforcement. */}
            {!onBehalfOfUserId ? (
              <TouchableOpacity
                onPress={() => setIsAnonymous(prev => !prev)}
                activeOpacity={0.8}
                accessibilityLabel={Strings.retroBoard.anonymousToggleHint}
                accessibilityRole="switch"
                accessibilityState={{ checked: isAnonymous }}
                style={{
                  flexDirection: 'row-reverse',
                  height: t.layout.minTouchTarget,
                  paddingHorizontal: t.space[3],
                  borderRadius: t.radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: isAnonymous ? t.color.accent.subtle : t.color.surfaceSubtle,
                  borderWidth: isAnonymous ? 1 : 0,
                  borderColor: t.color.accent.border,
                }}
              >
                <Icon name={isAnonymous ? 'eye-off' : 'eye'} size="sm" tone={isAnonymous ? 'accent' : 'muted'} />
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: isAnonymous ? t.color.accent.base : t.color.textSecondary }]}>
                  {isAnonymous ? Strings.retroBoard.anonymousToggleLabel : Strings.retroBoard.identifiedToggleLabel}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={{
                height: 40,
                borderRadius: t.radius.field,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: t.space[4],
                backgroundColor: t.color.text,
              }}
              onPress={handlePostComment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={t.color.bg} size="small" />
              ) : (
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.bg }]}>
                  {Strings.retroBoard.postNoteButton}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        {!isLoading && !loadError && comments.length > 0 && (
          <View style={{ marginTop: t.space[2] }}>
            <CommentFilterBarNative
              categories={filterCategories}
              onCategoriesChange={setFilterCategories}
              categoryOptions={filterCategoryOptions}
              searchText={filterText}
              onSearchTextChange={setFilterText}
              highlightedOnly={highlightedOnly}
              onHighlightedOnlyChange={(value: boolean) => {
                setHighlightedOnly(value);
                trackEvent('retro_highlighted_filter_toggled', { value });
              }}
            />
          </View>
        )}

        {/* Board columns (RTL flow) */}
        {isLoading ? (
          <View style={{ padding: t.space[6], alignItems: 'center', gap: t.space[2] }}>
            <ActivityIndicator size="large" color={t.color.text} />
            <Text style={[rnText(t.type.body), { color: t.color.text }]}>{Strings.retroBoard.loadingBoard}</Text>
          </View>
        ) : loadError ? (
          <LoadErrorNative message={loadError} onRetry={fetchComments} screen="retro_board" />
        ) : (
          <View style={{ flexDirection: isDesktop ? 'row-reverse' : 'column', gap: t.space[4], marginTop: t.space[2] }}>
            {/* Column 1: KEEP */}
            <View style={{ flex: 1, gap: t.space[3] }}>
              <View
                style={{
                  padding: t.space[2],
                  borderRadius: t.radius.badge,
                  borderWidth: 1,
                  alignItems: 'center',
                  backgroundColor: t.color.status.success.bg,
                  borderColor: t.color.status.success.border,
                }}
              >
                <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.status.success.fg }]}>
                  {Strings.retroBoard.keepColumnHeader}
                </Text>
              </View>

              {keepComments.length === 0 ? (
                <Text style={[rnText(t.type.caption), { textAlign: 'center', color: t.color.textMuted, marginVertical: t.space[2] }]}>
                  {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyKeepText}
                </Text>
              ) : (
                keepComments.map(comment => renderCommentCard(comment, t.color.status.success))
              )}
            </View>

            {/* Column 2: IMPROVE */}
            <View style={{ flex: 1, gap: t.space[3] }}>
              <View
                style={{
                  padding: t.space[2],
                  borderRadius: t.radius.badge,
                  borderWidth: 1,
                  alignItems: 'center',
                  backgroundColor: t.color.status.danger.bg,
                  borderColor: t.color.status.danger.border,
                }}
              >
                <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.status.danger.fg }]}>
                  {Strings.retroBoard.improveColumnHeader}
                </Text>
              </View>

              {improveComments.length === 0 ? (
                <Text style={[rnText(t.type.caption), { textAlign: 'center', color: t.color.textMuted, marginVertical: t.space[2] }]}>
                  {isFilterActive ? Strings.retroBoard.noMatchingCommentsText : Strings.retroBoard.emptyImproveText}
                </Text>
              ) : (
                improveComments.map(comment => renderCommentCard(comment, t.color.status.danger))
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
