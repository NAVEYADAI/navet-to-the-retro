import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { trackEvent } from '@/lib/analytics';
import type { SprintRouteStatus } from '../hooks/use-sprint-route-data';

interface Props {
  status: Exclude<SprintRouteStatus, 'ready'>;
  onRetry: () => void;
  onBackToDashboard: () => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

/** Loading / not-found / error placeholder shown while a sprint route resolves its sprint + team. */
export function SprintRouteStateNative({ status, onRetry, onBackToDashboard }: Props) {
  const t = useTheme();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[2] }}>
        <ActivityIndicator size="large" color={t.color.text} />
        <Text style={[rnText(t.type.body), { color: t.color.textSecondary }]}>{Strings.sprintRoute.loading}</Text>
      </View>
    );
  }

  const isNotFound = status === 'notFound';
  const buttonStyle = {
    minHeight: t.layout.minTouchTarget,
    paddingHorizontal: t.space[4],
    borderRadius: t.radius.field,
    borderWidth: 1,
    borderColor: t.color.borderStrong,
    backgroundColor: t.color.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.space[4] }}>
      <View
        style={{
          width: '100%',
          maxWidth: 480,
          padding: t.space[4],
          gap: t.space[3],
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color.surface,
        }}
      >
        <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'center' }]}>
          {isNotFound ? Strings.sprintRoute.notFoundTitle : Strings.sprintRoute.loadError}
        </Text>
        {isNotFound ? (
          <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'center' }]}>
            {Strings.sprintRoute.notFoundText}
          </Text>
        ) : null}
        {isNotFound ? null : (
          <TouchableOpacity
            style={buttonStyle}
            onPress={() => { trackEvent('sprint_route_retry_clicked'); onRetry(); }}
          >
            <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>{Strings.sprintRoute.retryButton}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={buttonStyle}
          onPress={() => { trackEvent('sprint_route_back_to_dashboard_clicked', { status }); onBackToDashboard(); }}
        >
          <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.textSecondary }]}>
            {Strings.sprintRoute.backToDashboardButton}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
