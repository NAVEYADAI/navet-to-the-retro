import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch, Platform } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
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
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New comment state
  const [content, setContent] = useState('');
  const [type, setType] = useState<'KEEP' | 'IMPROVE'>('KEEP');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBackendUrl = () => {
    return typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
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
      setError('Comment content cannot be empty.');
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
      setError(err.response?.data?.message || err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myMembership = team.members?.find((m: any) => m.userId === user.id);
  const isAdmin = myMembership?.isAdmin || false;

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.backgroundSelected }]} onPress={onBack}>
          <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: theme.text }}>
            ← Back to Dashboard
          </ThemedText>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            {sprint.name} Retro
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
        <ThemedText type="default" style={{ fontWeight: 'bold', fontSize: 14 }}>
          Write Retro Note
        </ThemedText>

        {!!error && (
          <View style={styles.errorBanner}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        <TextInput
          style={[
            styles.textarea,
            {
              color: theme.text,
              borderColor: theme.backgroundSelected,
              backgroundColor: theme.background,
            },
          ]}
          placeholder="What's on your mind? (Keep / Improve)"
          placeholderTextColor={theme.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
        />

        <View style={styles.formControls}>
          {/* Toggle Type */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeBadge,
                { backgroundColor: type === 'KEEP' ? '#2e7d32' : theme.background, borderColor: theme.backgroundSelected }
              ]}
              onPress={() => setType('KEEP')}
            >
              <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: type === 'KEEP' ? '#fff' : theme.text }}>
                Keep (שימור)
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBadge,
                { backgroundColor: type === 'IMPROVE' ? '#c62828' : theme.background, borderColor: theme.backgroundSelected }
              ]}
              onPress={() => setType('IMPROVE')}
            >
              <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: type === 'IMPROVE' ? '#fff' : theme.text }}>
                Improve (שיפור)
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Anonymous Switch */}
          <View style={styles.anonControl}>
            <ThemedText type="default" style={{ fontSize: 12, opacity: 0.8 }}>
              Anonymous
            </ThemedText>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: theme.backgroundSelected, true: theme.text }}
              thumbColor={isAnonymous ? theme.background : theme.backgroundSelected}
            />
          </View>
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
              Post Note
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Board Columns */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.text} />
          <ThemedText type="default">Loading retro board...</ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.boardScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.columnsContainer}>
            {/* Column 1: KEEP */}
            <View style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: 'rgba(46, 125, 50, 0.08)', borderColor: '#2e7d32' }]}>
                <ThemedText type="default" style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                  Keep (שימור) 🟢
                </ThemedText>
              </View>

              {keepComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>No keep notes yet.</ThemedText>
              ) : (
                keepComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: theme.backgroundElement, borderLeftColor: '#2e7d32' }]}
                  >
                    <ThemedText type="default" style={styles.commentContent}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? `Anonymous (by @${comment.author.username})`
                            : 'Anonymous'}
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.metaText}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5 }]}>
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
                  Improve (שיפור) 🔴
                </ThemedText>
              </View>

              {improveComments.length === 0 ? (
                <ThemedText type="default" style={styles.emptyColumnText}>No improvement notes yet.</ThemedText>
              ) : (
                improveComments.map(comment => (
                  <View
                    key={comment.id}
                    style={[styles.commentCard, { backgroundColor: theme.backgroundElement, borderLeftColor: '#c62828' }]}
                  >
                    <ThemedText type="default" style={styles.commentContent}>
                      {comment.content}
                    </ThemedText>
                    
                    <View style={styles.commentMeta}>
                      {comment.isAnonymous ? (
                        <ThemedText style={[styles.metaText, { fontStyle: 'italic', color: '#ff8f00' }]}>
                          {comment.author.username !== 'Anonymous' && isAdmin
                            ? `Anonymous (by @${comment.author.username})`
                            : 'Anonymous'}
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.metaText}>
                          {`@${comment.author.username}`}
                        </ThemedText>
                      )}
                      <ThemedText style={[styles.metaText, { opacity: 0.5 }]}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    gap: Spacing.three,
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
  },
  title: {
    fontSize: 24,
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
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
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
    marginTop: Spacing.one,
  },
  loaderContainer: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  boardScroll: {
    flex: 1,
  },
  columnsContainer: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  column: {
    flex: 1,
    gap: Spacing.two,
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
    padding: Spacing.two,
    borderRadius: 8,
    borderLeftWidth: 4,
    gap: Spacing.two,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
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
