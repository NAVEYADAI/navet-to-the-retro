import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, type TextStyle } from 'react-native';
import axios from 'axios';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { LoadErrorNative } from '@/components/load-error-native';
import { MemoryCardNative } from './memory-card-native';
import { trackEvent } from '@/lib/analytics';

interface MemoryBoardNativeProps {
  sprint: any;
  team: any;
  token: string;
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

export function MemoryBoardNative({ sprint, team, token, onBack }: MemoryBoardNativeProps) {
  const t = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // BUG-34: a failed load must not render as "no cards".
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments for memory board:', err);
      setLoadError(Strings.memoryBoard.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [sprint.id, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const keepComments = comments.filter(c => c.type === 'KEEP');
  const improveComments = comments.filter(c => c.type === 'IMPROVE');

  const renderCanvas = (
    title: string,
    icon: 'check' | 'wrench',
    tone: 'success' | 'danger',
    list: any[],
    emptyText: string
  ) => (
    <View style={{ gap: t.space[3] }}>
      <View
        style={{
          paddingVertical: t.space[2],
          borderRadius: t.radius.card,
          borderWidth: 1,
          alignItems: 'center',
          backgroundColor: t.color.status[tone].bg,
          borderColor: t.color.status[tone].border,
          flexDirection: 'row-reverse',
          justifyContent: 'center',
          gap: t.space[1],
        }}
      >
        <Icon name={icon} tone={tone} />
        <Text style={[rnText({ ...t.type.cardTitle, fontWeight: 700 }), { color: t.color.status[tone].fg }]}>
          {title}
        </Text>
      </View>

      {list.length === 0 ? (
        <Text style={[rnText(t.type.body), { color: t.color.textSecondary, fontStyle: 'italic', textAlign: 'center' }]}>
          {emptyText}
        </Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.space[4],
            padding: t.space[4],
            borderRadius: t.radius.card,
            backgroundColor: t.color.surfaceSubtle,
            minHeight: 220,
          }}
        >
          {list.map(comment => (
            <MemoryCardNative key={comment.id} comment={comment} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ paddingTop: 100, paddingBottom: t.space[6] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: t.space[4], gap: t.space[4], maxWidth: 1100, alignSelf: 'center', width: '100%' }}>
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
          <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 1 }}>
            <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>
              {Strings.memoryBoard.pageTitle}
            </Text>
            <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
              {Strings.memoryBoard.pageSubtitle}
            </Text>
          </View>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
            <TouchableOpacity
              style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
              onPress={() => { trackEvent('refresh_clicked', { screen: 'memory_board' }); fetchComments(); }}
              disabled={isLoading}
            >
              <Icon name="refresh" size="sm" tone="muted" />
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                {Strings.common.refreshButton}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
              onPress={onBack}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                {Strings.memoryBoard.backButton}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={{ padding: t.space[6], alignItems: 'center', gap: t.space[2] }}>
            <ActivityIndicator size="large" color={t.color.text} />
            <Text style={[rnText(t.type.body), { color: t.color.text }]}>{Strings.memoryBoard.loadingBoard}</Text>
          </View>
        ) : loadError ? (
          <LoadErrorNative message={loadError} onRetry={fetchComments} screen="memory_board" />
        ) : (
          <View style={{ gap: t.space[6] }}>
            {renderCanvas(Strings.memoryBoard.keepCanvasHeader, 'check', 'success', keepComments, Strings.memoryBoard.emptyKeepText)}
            {renderCanvas(Strings.memoryBoard.improveCanvasHeader, 'wrench', 'danger', improveComments, Strings.memoryBoard.emptyImproveText)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
