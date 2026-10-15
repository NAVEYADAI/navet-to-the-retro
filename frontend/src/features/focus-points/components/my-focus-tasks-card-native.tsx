import React from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { useMyFocusTasks } from '../hooks/use-my-focus-tasks';
import { formatDueDate } from './format-due';
import { CardNative, TextNative } from './native-parts';

const S = Strings.focusPoints;

export function MyFocusTasksCardNative({ token, refreshKey }: { token: string | null | undefined; refreshKey: number }) {
  const t = useTheme();
  const { items, loadError } = useMyFocusTasks(token, refreshKey);
  if (items.length === 0 && !loadError) return null;
  return (
    <CardNative>
      <TextNative kind="title">{`${S.myTasksTitle}${items.length > 0 ? ` (${items.length})` : ''}`}</TextNative>
      {loadError ? <TextNative kind="caption" color={t.color.status.danger.fg}>{loadError}</TextNative> : items.map((task) => (
        <View key={task.id} style={{ gap: 2, padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
          <TextNative bold>{task.title}</TextNative>
          <TextNative kind="caption">{`${task.focusPoint?.team.name ?? ''}${task.dueDate ? ` · ${S.taskDue} ${formatDueDate(task.dueDate)}` : ''}`}</TextNative>
          {task.focusPoint ? <TextNative kind="caption" color={t.color.textMuted}>{task.focusPoint.text}</TextNative> : null}
        </View>
      ))}
    </CardNative>
  );
}
