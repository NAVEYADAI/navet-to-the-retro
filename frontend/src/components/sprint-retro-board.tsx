import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch, Platform, useColorScheme, useWindowDimensions, Animated } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import axios from 'axios';

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

export function SprintRetroBoard({ sprint, team, token, user, theme, onBack }: SprintRetroBoardProps) {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animated spin value for the Yin-Yang wheel
  const [spinAnim] = useState(new Animated.Value(type === 'KEEP' ? 0 : 1));

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

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
        isAnonymous
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setContent('');
      setIsAnonymous(false);
      await fetchComments();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'שגיאה בשליחת ההערה.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animate Yin-Yang spin on toggle
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

  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const isAdmin = myMembership?.isAdmin || false;

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  // Sticky-notes themes
  const keepBg = colorScheme === 'dark' ? '#1b5e20' : '#e8f5e9';
  const keepText = colorScheme === 'dark' ? '#e8f5e9' : '#1b5e20';
  const keepMetaText = colorScheme === 'dark' ? '#a5d6a7' : '#2e7d32';

  const improveBg = colorScheme === 'dark' ? '#b71c1c' : '#ffebee';
  const improveText = colorScheme === 'dark' ? '#ffebee' : '#b71c1c';
  const improveMetaText = colorScheme === 'dark' ? '#ef9a9a' : '#c62828';

  // Rotation interpolations
  const wheelRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const contentRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-180deg'], // Opposite rotation to keep content upright
  });

  return (
    <ScrollView 
      style={[styles.scrollContainer, { backgroundColor: theme.background }]} 
      contentContainerStyle={{ paddingTop: isDesktop ? 80 : 100, paddingBottom: Spacing.four }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.backgroundSelected }]} onPress={onBack}>
            <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
              {Strings.retroBoard.backButton}
            </ThemedText>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>
              {sprint.name} {Strings.retroBoard.keepLabel.split(' ')[1]}
            </ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
            </ThemedText>
            {sprint.description && (
              <ThemedText type="default" style={styles.description}>
                {sprint.description}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Main Form for Posting */}
        <View style={[styles.postSection, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14, marginBottom: Spacing.one }}>
            {Strings.retroBoard.writeNoteHeader}
          </ThemedText>

          {!!error && (
            <View style={styles.errorBanner}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Yin-Yang Style Animated Toggle Wheel */}
          <View style={styles.wheelWrapper}>
            <TouchableOpacity activeOpacity={0.9} onPress={toggleType}>
              <Animated.View style={[styles.yinYangWheel, { transform: [{ rotate: wheelRotation }] }]}>
                {/* Keep Half (Top) */}
                <View style={[styles.wheelHalf, styles.keepHalf, { backgroundColor: keepBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>👍</ThemedText>
                  </Animated.View>
                </View>

                {/* Improve Half (Bottom) */}
                <View style={[styles.wheelHalf, styles.improveHalf, { backgroundColor: improveBg }]}>
                  <Animated.View style={{ transform: [{ rotate: contentRotation }] }}>
                    <ThemedText style={{ fontSize: 24 }}>🔧</ThemedText>
                  </Animated.View>
                </View>

                {/* Yin-Yang Center Circle divider */}
                <View style={[styles.wheelCenter, { backgroundColor: theme.backgroundElement }]} />
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.wheelLabelContainer}>
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 2 }}>
                {Strings.retroBoard.spinLabel}
              </ThemedText>
              <ThemedText style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: type === 'KEEP' ? '#2e7d32' : '#c62828'
              }}>
                {type === 'KEEP' ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
              </ThemedText>
            </View>
          </View>

          <TextInput
            style={[
              styles.textarea,
              {
                color: theme.text,
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.background,
              },
            ]}
            placeholder={type === 'KEEP' ? "מה עבד טוב? ציין הישגים..." : "מה אפשר לשפר? הצע שיפורים..."}
            placeholderTextColor={theme.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={3}
          />

          <View style={styles.formControls}>
            {/* Anonymous Switch */}
            <View style={styles.anonControl}>
              <ThemedText type="default" style={{ fontSize: 12, opacity: 0.8 }}>
                {Strings.retroBoard.anonymousLabel}
              </ThemedText>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: theme.backgroundSelected, true: theme.text }}
                thumbColor={isAnonymous ? theme.background : theme.backgroundSelected}
              />
            </View>

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

        {/* Board Columns */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText type="default">{Strings.retroBoard.loadingBoard}</ThemedText>
          </View>
        ) : (
          <View style={[styles.columnsContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
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
                    style={[styles.commentCard, { backgroundColor: keepBg, borderLeftColor: '#2e7d32' }]}
                  >
                    <ThemedText type="default" style={[styles.commentContent, { color: keepText }]}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                            : Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: keepMetaText }]}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5, color: keepMetaText }]}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    style={[styles.commentCard, { backgroundColor: improveBg, borderLeftColor: '#c62828' }]}
                  >
                    <ThemedText type="default" style={[styles.commentContent, { color: improveText }]}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? Strings.retroBoard.anonymousByAdmin(comment.author.username)
                            : Strings.retroBoard.anonymousAuthor}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.metaText, { color: improveMetaText }]}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5, color: improveMetaText }]}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: 1100, // Gorgeous wide board
    gap: Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  titleContainer: {
    gap: 2,
    marginTop: Spacing.one,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  description: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
    fontStyle: 'italic',
  },
  postSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  wheelWrapper: {
    flexDirection: 'row',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
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
    alignItems: 'flex-start',
  },
  textarea: {
    height: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  formControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  anonControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
    borderLeftWidth: 5,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  commentMeta: {
    flexDirection: 'row',
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
  errorBanner: {
    backgroundColor: '#ffebee',
    padding: Spacing.two,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 13,
    textAlign: 'center',
  },
});
