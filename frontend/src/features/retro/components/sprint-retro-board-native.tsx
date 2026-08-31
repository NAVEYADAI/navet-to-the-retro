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
import { CommentFilterBarNative } from './comment-filter-bar-native';

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  onBack: () => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function SprintRetroBoardNative({ sprint, team, token, user, onBack }: SprintRetroBoardProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [category, setCategory] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comment list filters (distinct from the compose-form state above)
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');

  // Press-triggered scale feedback for the KEEP/IMPROVE toggle (no animation on mount/type-change).
  const [wheelScale] = useState(new Animated.Value(1));

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
    setType(prev => (prev === 'KEEP' ? 'IMPROVE' : 'KEEP'));
  };

  const handleWheelPressIn = () => {
    Animated.spring(wheelScale, { toValue: 0.92, useNativeDriver: Platform.OS !== 'web', speed: 40 }).start();
  };

  const handleWheelPressOut = () => {
    Animated.spring(wheelScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 40 }).start();
  };

  const matchesFilters = (c: any) =>
    (filterCategories.length === 0 || filterCategories.includes(c.category)) &&
    (!filterText.trim() || c.content?.toLowerCase().includes(filterText.trim().toLowerCase()));

  const keepComments = comments.filter(c => c.type === 'KEEP' && matchesFilters(c));
  const improveComments = comments.filter(c => c.type === 'IMPROVE' && matchesFilters(c));
  const isFilterActive = filterCategories.length > 0 || !!filterText.trim();

  const isKeep = type === 'KEEP';
  const wheelTone = isKeep ? t.color.status.success : t.color.status.danger;

  const renderCommentCard = (comment: any, accent: { fg: string; bg: string; border: string }) => {
    const categoryLabel = comment.category ? Strings.retroBoard.categories[comment.category] : null;
    const authorName = comment.isAnonymous
      ? Strings.retroBoard.anonymousAuthor
      : `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username;

    return (
      <View
        key={comment.id}
        style={{
          backgroundColor: t.color.surface,
          borderRightWidth: 3,
          borderRightColor: accent.fg,
          borderRadius: t.radius.card,
          padding: t.space[3],
          gap: t.space[2],
        }}
      >
        {!!categoryLabel && (
          <View
            style={{
              alignSelf: 'flex-end',
              backgroundColor: accent.bg,
              borderRadius: t.radius.pill,
              borderTopRightRadius: t.radius.badge,
              paddingHorizontal: t.space[2],
              paddingVertical: 3,
            }}
          >
            <Text style={[rnText(t.type.overline), { color: accent.fg }]}>{categoryLabel}</Text>
          </View>
        )}
        <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>
          {comment.content}
        </Text>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[rnText({ ...t.type.caption, fontWeight: comment.isAnonymous ? 400 : 700 }), { color: t.color.textSecondary }]}>
            {authorName}
          </Text>
          <Text style={[rnText(t.type.caption), { color: t.color.textMuted }]}>
            {`${new Date(comment.createdAt).toLocaleDateString('he-IL')} · ${new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
        </View>
      </View>
    );
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
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingBottom: t.space[3],
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <TouchableOpacity
            style={{ paddingHorizontal: t.space[3], paddingVertical: t.space[1] + 2, borderRadius: t.radius.field, backgroundColor: t.color.surfaceSubtle }}
            onPress={onBack}
          >
            <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
              {Strings.retroBoard.backButton}
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>
              {sprint.name}
            </Text>
            <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
              {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
            </Text>
            {!!sprint.description && (
              <Text style={[rnText(t.type.caption), { color: t.color.textMuted, textAlign: 'right' }]}>
                {sprint.description}
              </Text>
            )}
          </View>
        </View>

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

          <TouchableOpacity
            onPress={() => setIsCategoryPickerOpen(true)}
            activeOpacity={0.8}
            style={{
              alignSelf: 'flex-end',
              paddingVertical: t.space[1] + 2,
              paddingHorizontal: t.space[3] + 2,
              borderRadius: t.radius.pill,
              borderTopRightRadius: t.radius.badge,
              backgroundColor: category ? t.color.accent.subtle : t.color.surfaceSubtle,
            }}
          >
            <Text style={[rnText({ ...t.type.label, fontWeight: category ? 700 : 400 }), { color: category ? t.color.accent.base : t.color.textSecondary }]}>
              {category ? Strings.retroBoard.categories[category] : Strings.retroBoard.categoryLabel}
            </Text>
          </TouchableOpacity>

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
                  data={[['', Strings.retroBoard.categoryNone] as [string, string], ...Object.entries(Strings.retroBoard.categories)]}
                  keyExtractor={([key]) => key || 'none'}
                  renderItem={({ item: [key, label] }) => (
                    <TouchableOpacity
                      onPress={() => { setCategory(key); setIsCategoryPickerOpen(false); }}
                      style={{
                        paddingVertical: t.space[3] + 2,
                        paddingHorizontal: t.space[5],
                        backgroundColor: category === key ? t.color.surfaceSubtle : 'transparent',
                      }}
                    >
                      <Text style={[rnText({ ...t.type.body, fontWeight: category === key ? 700 : 400 }), { color: t.color.text, textAlign: 'right' }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: t.space[1] }}>
            <TouchableOpacity
              onPress={() => setIsAnonymous(prev => !prev)}
              activeOpacity={0.8}
              accessibilityLabel={Strings.retroBoard.anonymousToggleHint}
              accessibilityRole="switch"
              accessibilityState={{ checked: isAnonymous }}
              style={{
                height: t.layout.minTouchTarget,
                paddingHorizontal: t.space[3],
                borderRadius: t.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isAnonymous ? t.color.accent.subtle : t.color.surfaceSubtle,
                borderWidth: isAnonymous ? 1 : 0,
                borderColor: t.color.accent.border,
              }}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: isAnonymous ? t.color.accent.base : t.color.textSecondary }]}>
                {isAnonymous ? Strings.retroBoard.anonymousToggleLabel : Strings.retroBoard.identifiedToggleLabel}
              </Text>
            </TouchableOpacity>

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
        {!isLoading && comments.length > 0 && (
          <View style={{ marginTop: t.space[2] }}>
            <CommentFilterBarNative
              categories={filterCategories}
              onCategoriesChange={setFilterCategories}
              searchText={filterText}
              onSearchTextChange={setFilterText}
            />
          </View>
        )}

        {/* Board columns (RTL flow) */}
        {isLoading ? (
          <View style={{ padding: t.space[6], alignItems: 'center', gap: t.space[2] }}>
            <ActivityIndicator size="large" color={t.color.text} />
            <Text style={[rnText(t.type.body), { color: t.color.text }]}>{Strings.retroBoard.loadingBoard}</Text>
          </View>
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
