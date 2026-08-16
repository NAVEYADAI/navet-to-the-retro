import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  useColorScheme as useRNColorScheme,
  useWindowDimensions,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { getShadow, retroNativeStyles } from '../styles/retro.styles';

interface SprintRetroBoardProps {
  sprint: any;
  team: any;
  token: string;
  user: any;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
  onBack: () => void;
}

export function SprintRetroBoardNative({ sprint, team, token, user, theme, onBack }: SprintRetroBoardProps) {
  const colorScheme = useRNColorScheme();
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

  // Animated spin value for the Yin-Yang wheel
  const [spinAnim] = useState(new Animated.Value(type === 'KEEP' ? 0 : 1));

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
    const nextType = type === 'KEEP' ? 'IMPROVE' : 'KEEP';
    Animated.spring(spinAnim, {
      toValue: nextType === 'KEEP' ? 0 : 1,
      tension: 30,
      friction: 6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    setType(nextType);
  };

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  // Wheel half colors
  const keepBg = colorScheme === 'dark' ? '#1b5e20' : '#e8f5e9';
  const improveBg = colorScheme === 'dark' ? '#b71c1c' : '#ffebee';

  // Rotation interpolations
  const wheelRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const contentRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-180deg'],
  });

  return (
    <ScrollView 
      style={[retroNativeStyles.scrollContainer, { backgroundColor: theme.background }]} 
      contentContainerStyle={{ paddingTop: isDesktop ? 80 : 100, paddingBottom: Spacing.four }}
      showsVerticalScrollIndicator={false}
    >
      <View style={retroNativeStyles.container}>
        {/* Header (RTL flow) */}
        <View style={[retroNativeStyles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <TouchableOpacity style={[retroNativeStyles.backButton, { backgroundColor: theme.backgroundSelected }]} onPress={onBack}>
            <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
              {Strings.retroBoard.backButton}
            </ThemedText>
          </TouchableOpacity>
          
          <View style={retroNativeStyles.titleContainer}>
            <ThemedText type="title" style={retroNativeStyles.title}>
              {sprint.name}
            </ThemedText>
            <ThemedText type="default" style={retroNativeStyles.subtitle}>
              {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
            </ThemedText>
            {sprint.description && (
              <ThemedText type="default" style={retroNativeStyles.description}>
                {sprint.description}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Main Form for Posting (RTL formatted) */}
        <View style={[
          retroNativeStyles.postSection,
          {
            backgroundColor: isAnonymous ? '#161618' : theme.backgroundElement,
            borderColor: isAnonymous ? '#8b5cf6' : type === 'KEEP' ? '#00e676' : '#ff1744',
            borderWidth: 2.5,
          },
          getShadow(0.04, 5, 3)
        ]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14, marginBottom: Spacing.one, textAlign: 'right', color: isAnonymous ? '#e8eaed' : undefined }}>
            {isAnonymous ? `🥸 ${Strings.retroBoard.writeNoteHeader}` : Strings.retroBoard.writeNoteHeader}
          </ThemedText>

          {!!error && (
            <View style={retroNativeStyles.errorBanner}>
              <ThemedText style={retroNativeStyles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Yin-Yang Style Animated Toggle Wheel */}
          <View style={retroNativeStyles.wheelWrapper}>
            <TouchableOpacity activeOpacity={0.9} onPress={toggleType}>
              <Animated.View style={[styles.yinYangWheel, { transform: [{ rotate: wheelRotation }] }]}>
                <View style={[styles.wheelHalf, styles.keepHalf, { backgroundColor: keepBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>👍</ThemedText>
                  </Animated.View>
                </View>
                <View style={[styles.wheelHalf, styles.improveHalf, { backgroundColor: improveBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>🔧</ThemedText>
                  </Animated.View>
                </View>
                <View style={[styles.wheelCenter, { backgroundColor: theme.backgroundElement }]} />
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.wheelLabelContainer}>
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2, textAlign: 'right' }}>
                {Strings.retroBoard.spinLabel}
              </ThemedText>
              <ThemedText style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: type === 'KEEP' ? '#2e7d32' : '#c62828',
                textAlign: 'right'
              }}>
                {type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
              </ThemedText>
            </View>
          </View>

          <TextInput
            style={[
              styles.textarea,
              {
                color: isAnonymous ? '#e8eaed' : theme.text,
                borderColor: isAnonymous ? 'rgba(139,92,246,0.4)' : theme.backgroundSelected,
                backgroundColor: isAnonymous ? 'rgba(255,255,255,0.04)' : theme.background,
              },
            ]}
            placeholder={type === 'KEEP' ? Strings.retroBoard.notePlaceholderKeep : Strings.retroBoard.notePlaceholderImprove}
            placeholderTextColor={isAnonymous ? 'rgba(232,234,237,0.5)' : theme.textSecondary}
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
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderTopRightRadius: 4,
              backgroundColor: isAnonymous
                ? 'rgba(139,92,246,0.18)'
                : category
                ? (colorScheme === 'dark' ? 'rgba(129,140,248,0.16)' : 'rgba(99,102,241,0.1)')
                : theme.backgroundSelected,
            }}
          >
            <ThemedText style={{
              fontSize: 13,
              fontWeight: category ? '700' : '400',
              color: category ? (isAnonymous ? '#e8eaed' : colorScheme === 'dark' ? '#818cf8' : '#6366f1') : theme.textSecondary,
            }}>
              {category ? Strings.retroBoard.categories[category] : Strings.retroBoard.categoryLabel}
            </ThemedText>
          </TouchableOpacity>

          <Modal
            visible={isCategoryPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsCategoryPickerOpen(false)}
          >
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
              activeOpacity={1}
              onPress={() => setIsCategoryPickerOpen(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={{ backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingVertical: 8 }}
              >
                <FlatList
                  data={[['', Strings.retroBoard.categoryNone] as [string, string], ...Object.entries(Strings.retroBoard.categories)]}
                  keyExtractor={([key]) => key || 'none'}
                  renderItem={({ item: [key, label] }) => (
                    <TouchableOpacity
                      onPress={() => { setCategory(key); setIsCategoryPickerOpen(false); }}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        backgroundColor: category === key ? theme.backgroundSelected : 'transparent',
                      }}
                    >
                      <ThemedText style={{ fontSize: 15, textAlign: 'right', fontWeight: category === key ? 'bold' : 'normal' }}>
                        {label}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={styles.formControls}>
            <TouchableOpacity
              onPress={() => setIsAnonymous(prev => !prev)}
              activeOpacity={0.8}
              accessibilityLabel={Strings.retroBoard.anonymousToggleHint}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isAnonymous ? '#3c4043' : theme.backgroundSelected,
                borderWidth: isAnonymous ? 1.5 : 0,
                borderColor: '#8b5cf6',
              }}
            >
              <ThemedText style={{ fontSize: 18 }}>{isAnonymous ? '🥸' : '👤'}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.text }]}
              onPress={handlePostComment}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <ThemedText style={{ fontWeight: 'bold', color: theme.background, fontSize: 13 }}>
                  {Strings.retroBoard.postNoteButton}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Board Columns (RTL Flow) */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText type="default">{Strings.retroBoard.loadingBoard}</ThemedText>
          </View>
        ) : (
          <View style={[styles.columnsContainer, { flexDirection: isDesktop ? 'row-reverse' : 'column' }]}>
            {/* Column 1: KEEP */}
            <View style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: 'rgba(46, 125, 50, 0.08)', borderColor: '#2e7d32' }]}>
                <ThemedText type="default" style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                  {Strings.retroBoard.keepColumnHeader}
                </ThemedText>
              </View>

              {keepComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>{Strings.retroBoard.emptyKeepText}</ThemedText>
              ) : (
                keepComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: theme.backgroundElement, borderRightColor: '#10b981' }, getShadow(0.03, 3, 2)]}
                  >
                    {!!comment.category && (
                      <View style={[styles.categoryChip, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#10b981' }}>
                          {Strings.retroBoard.categories[comment.category]}
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText type="default" style={[styles.commentContent, { color: theme.text }]}>
                      {comment.content}
                    </ThemedText>

                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontWeight: 'normal', color: theme.textSecondary }]}>
                          🥸 {Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {`${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.6, fontWeight: 'normal', color: theme.textSecondary }]}>
                        {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Column 2: IMPROVE */}
            <View style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: 'rgba(198, 40, 40, 0.08)', borderColor: '#c62828' }]}>
                <ThemedText type="default" style={{ fontWeight: 'bold', color: '#c62828' }}>
                  {Strings.retroBoard.improveColumnHeader}
                </ThemedText>
              </View>

              {improveComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>{Strings.retroBoard.emptyImproveText}</ThemedText>
              ) : (
                improveComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: theme.backgroundElement, borderRightColor: '#ef4444' }, getShadow(0.03, 3, 2)]}
                  >
                    {!!comment.category && (
                      <View style={[styles.categoryChip, { backgroundColor: 'rgba(239,68,68,0.14)' }]}>
                        <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: '#ef4444' }}>
                          {Strings.retroBoard.categories[comment.category]}
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText type="default" style={[styles.commentContent, { color: theme.text }]}>
                      {comment.content}
                    </ThemedText>

                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontWeight: 'normal', color: theme.textSecondary }]}>
                          🥸 {Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                          {`${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || comment.author.username}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.6, fontWeight: 'normal', color: theme.textSecondary }]}>
                        {new Date(comment.createdAt).toLocaleDateString('he-IL')} · {new Date(comment.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wheelWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginVertical: Spacing.two,
  },
  yinYangWheel: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHalf: {
    position: 'absolute',
    width: '100%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepHalf: {
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  improveHalf: {
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  wheelCenter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 10,
  },
  wheelLabelContainer: {
    alignItems: 'flex-end',
  },
  textarea: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  formControls: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitButton: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  loaderContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  columnsContainer: {
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  column: {
    flex: 1,
    gap: Spacing.three,
  },
  columnHeader: {
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyColumnText: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
    marginVertical: Spacing.two,
    fontStyle: 'italic',
  },
  commentCard: {
    padding: Spacing.three,
    borderRadius: 8,
    borderRightWidth: 3,
    gap: Spacing.two,
  },
  categoryChip: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    borderTopRightRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'right',
  },
  commentMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
