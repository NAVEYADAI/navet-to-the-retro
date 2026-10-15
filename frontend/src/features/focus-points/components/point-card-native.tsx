import React, { useState } from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { formatScore, historyLine, kindLabel, personName, statusLabel } from '../focus-points-logic';
import { formatDueDate } from './format-due';
import { ActionButtonNative, CardNative, LabeledInputNative, PillPickerNative, TextNative } from './native-parts';
import type { FocusPoint, TaskStatus } from '../types';

const S = Strings.focusPoints;

interface PointCardNativeProps {
  point: FocusPoint;
  resultsHidden: boolean;
  sprintId: number | null;
  mergeTargets: FocusPoint[];
  disabled: boolean;
  onToggleSelected: (selected: boolean) => void;
  onEdit: () => void;
  onSetStatus: (status: 'ACTIVE' | 'ARCHIVED') => void;
  onSetWatch: (n: number | null) => void;
  onMerge: (intoId: number) => void;
  onAddTask: () => void;
  onTaskStatus: (taskId: number, status: TaskStatus) => void;
  onRemoveTask: (taskId: number) => void;
}

const TASK_OPTIONS = [
  { value: 'OPEN', label: S.taskStatusOpen },
  { value: 'DONE', label: S.taskStatusDone },
  { value: 'DROPPED', label: S.taskStatusDropped },
];

export function PointCardNative(p: PointCardNativeProps) {
  const t = useTheme();
  const { point } = p;
  const isImprove = point.kind === 'IMPROVE';
  const selected = p.sprintId !== null && point.selectedSprintIds.includes(p.sprintId);
  const [mergeTo, setMergeTo] = useState('');
  const [watch, setWatch] = useState(point.watchSprintsLeft ? String(point.watchSprintsLeft) : '');
  const row = { flexDirection: 'row-reverse' as const, flexWrap: 'wrap' as const, gap: t.space[1] };

  return (
    <CardNative>
      <TextNative kind="caption">{[kindLabel(point.kind), isImprove ? statusLabel(point.status) : null, selected ? S.selectForSprint : null].filter(Boolean).join(' · ')}</TextNative>
      <TextNative bold>{point.text}</TextNative>
      {isImprove ? (
        <View style={{ gap: 2 }}>
          <TextNative kind="caption">{`${S.currentScore}: ${p.resultsHidden ? '—' : formatScore(point.currentScore)}${point.watchSprintsLeft ? ` · ${S.watchLeft(point.watchSprintsLeft)}` : ''}`}</TextNative>
          {point.history.map((h, i) => <TextNative key={i} kind="caption">{historyLine(h, p.resultsHidden)}</TextNative>)}
        </View>
      ) : <TextNative kind="caption">{S.mentions(point.mentionCount)}</TextNative>}

      {point.sources.length > 0 ? (
        <View style={{ gap: 2 }}>
          <TextNative kind="overline">{S.sourcesTitle}</TextNative>
          {point.sources.map((s) => <TextNative key={s.id} kind="caption">{`• ${s.content}`}</TextNative>)}
        </View>
      ) : null}

      <View style={row}>
        <ActionButtonNative variant="ghost" label={S.editButton} disabled={p.disabled} onPress={p.onEdit} />
        {isImprove && point.status === 'ACTIVE' && p.sprintId !== null ? <ActionButtonNative label={selected ? S.removeFromSprint : S.selectForSprint} disabled={p.disabled} onPress={() => p.onToggleSelected(!selected)} /> : null}
        {isImprove && point.status === 'ACTIVE' ? <ActionButtonNative variant="ghost" label={S.archiveButton} disabled={p.disabled} onPress={() => p.onSetStatus('ARCHIVED')} /> : null}
        {isImprove && point.status !== 'ACTIVE' ? <ActionButtonNative variant="ghost" label={S.reopenButton} disabled={p.disabled} onPress={() => p.onSetStatus('ACTIVE')} /> : null}
      </View>

      {isImprove && point.status === 'ACTIVE' ? (
        <View style={{ gap: t.space[1] }}>
          <LabeledInputNative label={S.watchLabel} value={watch} onChangeText={setWatch} keyboardType="number-pad" />
          <ActionButtonNative variant="ghost" label={S.watchSaveButton} disabled={p.disabled} onPress={() => p.onSetWatch(watch.trim() ? Number(watch) : null)} />
        </View>
      ) : null}

      {p.mergeTargets.length > 0 && point.status !== 'ARCHIVED' ? (
        <View style={{ gap: t.space[1] }}>
          <PillPickerNative label={S.mergePickLabel} value={mergeTo} onChange={setMergeTo} options={p.mergeTargets.map((m) => ({ value: String(m.id), label: m.text }))} />
          <ActionButtonNative label={S.mergeConfirmButton} disabled={p.disabled || !mergeTo} onPress={() => p.onMerge(Number(mergeTo))} />
        </View>
      ) : null}

      {isImprove ? (
        <View style={{ gap: t.space[2], borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: t.space[2] }}>
          <TextNative kind="overline">{S.tasksTitle}</TextNative>
          {point.tasks.length === 0 ? <TextNative kind="caption">{S.tasksEmpty}</TextNative> : null}
          {point.tasks.map((task) => (
            <View key={task.id} style={{ gap: t.space[1] }}>
              <TextNative>{task.title}</TextNative>
              <TextNative kind="caption">{`${task.assignee ? personName(task.assignee) : S.taskNoAssignee}${task.dueDate ? ` · ${S.taskDue} ${formatDueDate(task.dueDate)}` : ''}`}</TextNative>
              <PillPickerNative value={task.status} onChange={(v) => p.onTaskStatus(task.id, v as TaskStatus)} options={TASK_OPTIONS} />
              <ActionButtonNative variant="ghost" label={S.taskDeleteButton} disabled={p.disabled} onPress={() => p.onRemoveTask(task.id)} />
            </View>
          ))}
          <ActionButtonNative variant="ghost" label={S.addTaskButton} disabled={p.disabled} onPress={p.onAddTask} />
        </View>
      ) : null}
    </CardNative>
  );
}
