import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, type TextStyle } from 'react-native';
import axios from 'axios';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Strings } from '@/constants/strings';
import { getBackendUrl } from '@/api/config';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { computeSprintSummaryStats } from '../stats';
import { SPRINT_SUMMARY_TEMPLATES, type SprintSummaryTemplateId } from '../templates';

interface SprintSummaryNativeProps {
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

export function SprintSummaryNative({ sprint, team, token, onBack }: SprintSummaryNativeProps) {
  const t = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<SprintSummaryTemplateId>('classic');

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/sprints/${sprint.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments for summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sprint.id, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleDownload = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsDownloading(true);
    try {
      const url = `${getBackendUrl()}/teams/${team.id}/sprints/${sprint.id}/summary/export?template=${templateId}`;
      const file = await File.downloadFileAsync(url, new Directory(Paths.cache), {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      }
      setSuccessMessage(Strings.sprintSummary.downloadSuccessNativeText);
    } catch (err) {
      console.error('Failed to export sprint summary:', err);
      setError(Strings.sprintSummary.downloadErrorText);
    } finally {
      setIsDownloading(false);
    }
  };

  const stats = computeSprintSummaryStats(comments);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ paddingTop: 100, paddingBottom: t.space[6] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: t.space[4], gap: t.space[4], maxWidth: 700, alignSelf: 'center', width: '100%' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: t.space[3],
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
            <TouchableOpacity
              style={{ paddingHorizontal: t.space[3], paddingVertical: t.space[1] + 2, borderRadius: t.radius.field, backgroundColor: t.color.surfaceSubtle }}
              onPress={onBack}
            >
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>
                {Strings.sprintSummary.backButton}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[2], paddingVertical: t.space[1] }}
              onPress={fetchComments}
              disabled={isLoading}
            >
              <Icon name="refresh" size="sm" tone="muted" />
              <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.textSecondary }]}>
                {Strings.common.refreshButton}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>
            {Strings.sprintSummary.pageTitle}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={t.color.accent.base} style={{ marginTop: t.space[6] }} />
        ) : (
          <View
            style={{
              backgroundColor: t.color.surface,
              borderWidth: 1,
              borderColor: t.color.border,
              borderRadius: t.radius.card,
              padding: t.space[4],
              gap: t.space[3],
            }}
          >
            <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.text, textAlign: 'right' }]}>
              {sprint.name}
            </Text>
            <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>
              {`${team.name} • ${new Date(sprint.startDate).toLocaleDateString()} - ${new Date(sprint.endDate).toLocaleDateString()}`}
            </Text>

            {!!error && (
              <View style={{ backgroundColor: t.color.status.danger.bg, borderWidth: 1, borderColor: t.color.status.danger.border, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'center' }]}>{error}</Text>
              </View>
            )}
            {!!successMessage && (
              <View style={{ backgroundColor: t.color.status.success.bg, borderWidth: 1, borderColor: t.color.status.success.border, borderRadius: t.radius.field, padding: t.space[2] }}>
                <Text style={[rnText(t.type.caption), { color: t.color.status.success.fg, textAlign: 'center' }]}>{successMessage}</Text>
              </View>
            )}

            {stats.total === 0 ? (
              <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right', fontStyle: 'italic' }]}>
                {Strings.sprintSummary.noCommentsText}
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[4] }}>
                  <View style={{ gap: 4, minWidth: 90 }}>
                    <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>
                      {Strings.sprintSummary.totalCommentsLabel}
                    </Text>
                    <Text style={[rnText(t.type.sectionTitle), { color: t.color.text, textAlign: 'right' }]}>{stats.total}</Text>
                  </View>
                  <View style={{ gap: 4, minWidth: 90 }}>
                    <Text style={[rnText(t.type.label), { color: t.color.status.success.fg, textAlign: 'right' }]}>
                      {Strings.sprintSummary.keepCountLabel}
                    </Text>
                    <Text style={[rnText(t.type.sectionTitle), { color: t.color.status.success.fg, textAlign: 'right' }]}>{stats.keepCount}</Text>
                  </View>
                  <View style={{ gap: 4, minWidth: 90 }}>
                    <Text style={[rnText(t.type.label), { color: t.color.status.danger.fg, textAlign: 'right' }]}>
                      {Strings.sprintSummary.improveCountLabel}
                    </Text>
                    <Text style={[rnText(t.type.sectionTitle), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{stats.improveCount}</Text>
                  </View>
                </View>

                {stats.byCategory.length > 0 && (
                  <View style={{ gap: t.space[1] + 2 }}>
                    <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 700 }), { color: t.color.text, textAlign: 'right' }]}>
                      {Strings.sprintSummary.byCategoryHeader}
                    </Text>
                    {stats.byCategory.map(({ label, count }) => (
                      <View
                        key={label}
                        style={{
                          flexDirection: 'row-reverse',
                          justifyContent: 'space-between',
                          paddingVertical: t.space[1] + 2,
                          borderBottomWidth: 1,
                          borderBottomColor: t.color.border,
                        }}
                      >
                        <Text style={[rnText(t.type.body), { color: t.color.text }]}>{label}</Text>
                        <Text style={[rnText(t.type.body), { color: t.color.textSecondary }]}>{count}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ gap: t.space[2] }}>
              <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>
                {Strings.sprintSummary.templateLabel}
              </Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] }}>
                {SPRINT_SUMMARY_TEMPLATES.map((tpl) => {
                  const selected = templateId === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      onPress={() => setTemplateId(tpl.id)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: t.space[1] + 2,
                        borderRadius: t.radius.pill,
                        borderWidth: 1.5,
                        borderColor: selected ? t.color.accent.base : t.color.border,
                        backgroundColor: selected ? t.color.accent.subtle : t.color.surface,
                        paddingVertical: 7,
                        paddingHorizontal: t.space[3],
                      }}
                    >
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: tpl.swatch }} />
                      <Text style={[
                        rnText({ ...t.type.caption, fontWeight: selected ? 700 : 500 }),
                        { color: selected ? t.color.accent.base : t.color.textSecondary },
                      ]}>
                        {tpl.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDownload}
              disabled={isDownloading}
              activeOpacity={0.85}
              style={{
                alignSelf: 'flex-end',
                backgroundColor: isDownloading ? t.color.surfaceSubtle : t.color.accent.base,
                borderRadius: t.radius.field,
                paddingVertical: t.space[2] + 2,
                paddingHorizontal: t.space[4],
              }}
            >
              <Text style={[rnText({ ...t.type.bodyStrong, fontWeight: 600 }), { color: isDownloading ? t.color.textMuted : t.color.accent.onBase }]}>
                {isDownloading ? Strings.sprintSummary.downloadingButton : Strings.sprintSummary.downloadButton}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
