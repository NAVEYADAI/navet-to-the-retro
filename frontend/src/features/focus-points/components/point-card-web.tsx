import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Field, Segmented } from '@/components/ui';
import { formatScore, historyLine, kindLabel, personName, statusLabel } from '../focus-points-logic';
import { formatDueDate } from './format-due';
import type { FocusPoint, TaskStatus } from '../types';

const S = Strings.focusPoints;

interface PointCardWebProps {
  point: FocusPoint;
  resultsHidden: boolean;
  /** The sprint currently picked on the screen, or null when the team has none. */
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
  { value: 'OPEN' as const, label: S.taskStatusOpen },
  { value: 'DONE' as const, label: S.taskStatusDone },
  { value: 'DROPPED' as const, label: S.taskStatusDropped },
];

export function PointCardWeb(p: PointCardWebProps) {
  const t = useTheme();
  const { point } = p;
  const isImprove = point.kind === 'IMPROVE';
  const selected = p.sprintId !== null && point.selectedSprintIds.includes(p.sprintId);
  const [mergeTo, setMergeTo] = useState('');
  const [watch, setWatch] = useState(point.watchSprintsLeft ? String(point.watchSprintsLeft) : '');
  const caption = { ...t.type.caption, color: t.color.textSecondary };

  return (
    <Card>
      <Box data-testid="focus-point-card" sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px` }}>
          <Badge tone={isImprove ? 'accent' : 'success'}>{kindLabel(point.kind)}</Badge>
          {isImprove ? <Badge tone={point.status === 'ACTIVE' ? 'neutral' : 'warning'}>{statusLabel(point.status)}</Badge> : null}
          {selected ? <Badge tone="accent">{S.selectForSprint}</Badge> : null}
        </Box>
        <Typography sx={{ ...t.type.bodyStrong, color: t.color.text, overflowWrap: 'anywhere' }}>{point.text}</Typography>

        {isImprove ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
            <Typography sx={caption}>
              {S.currentScore}: <bdi>{p.resultsHidden ? '—' : formatScore(point.currentScore)}</bdi>
              {point.watchSprintsLeft ? ` · ${S.watchLeft(point.watchSprintsLeft)}` : ''}
            </Typography>
            {point.history.map((h, i) => (
              <Typography key={i} sx={caption}>{historyLine(h, p.resultsHidden)}</Typography>
            ))}
          </Box>
        ) : (
          <Typography sx={caption}>{S.mentions(point.mentionCount)}</Typography>
        )}

        {point.sources.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
            <Typography sx={{ ...t.type.overline, color: t.color.textMuted }}>{S.sourcesTitle}</Typography>
            {point.sources.map((s) => (
              <Typography key={s.id} sx={{ ...caption, overflowWrap: 'anywhere' }}>• {s.content}</Typography>
            ))}
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[1]}px` }}>
          <Button variant="ghost" size="sm" icon="edit" disabled={p.disabled} onPress={p.onEdit}>{S.editButton}</Button>
          {isImprove && point.status === 'ACTIVE' && p.sprintId !== null ? (
            <Button variant="secondary" size="sm" disabled={p.disabled} onPress={() => p.onToggleSelected(!selected)}>
              {selected ? S.removeFromSprint : S.selectForSprint}
            </Button>
          ) : null}
          {isImprove && point.status === 'ACTIVE' ? (
            <Button variant="ghost" size="sm" disabled={p.disabled} onPress={() => p.onSetStatus('ARCHIVED')}>{S.archiveButton}</Button>
          ) : null}
          {isImprove && point.status !== 'ACTIVE' ? (
            <Button variant="ghost" size="sm" disabled={p.disabled} onPress={() => p.onSetStatus('ACTIVE')}>{S.reopenButton}</Button>
          ) : null}
        </Box>

        {isImprove && point.status === 'ACTIVE' ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: `${t.space[2]}px` }}>
            <Box sx={{ width: 120 }}>
              <Field type="number" label={S.watchLabel} value={watch} onChangeText={setWatch} />
            </Box>
            <Button variant="ghost" size="sm" disabled={p.disabled} onPress={() => p.onSetWatch(watch.trim() ? Number(watch) : null)}>{S.watchSaveButton}</Button>
          </Box>
        ) : null}

        {p.mergeTargets.length > 0 && point.status !== 'ARCHIVED' ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: `${t.space[2]}px` }}>
            <Box sx={{ minWidth: 200, flex: 1 }}>
              <Field
                type="select"
                label={S.mergePickLabel}
                value={mergeTo}
                onChangeText={setMergeTo}
                options={[{ value: '', label: S.mergeButton }, ...p.mergeTargets.map((m) => ({ value: String(m.id), label: m.text }))]}
              />
            </Box>
            <Button variant="secondary" size="sm" disabled={p.disabled || !mergeTo} onPress={() => p.onMerge(Number(mergeTo))}>{S.mergeConfirmButton}</Button>
          </Box>
        ) : null}

        {isImprove ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[2]}px`, borderTop: `1px solid ${t.color.border}`, paddingTop: `${t.space[3]}px` }}>
            <Typography sx={{ ...t.type.overline, color: t.color.textMuted }}>{S.tasksTitle}</Typography>
            {point.tasks.length === 0 ? <Typography sx={caption}>{S.tasksEmpty}</Typography> : null}
            {point.tasks.map((task) => (
              <Box key={task.id} data-testid="focus-point-task" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px` }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ ...t.type.body, color: t.color.text, textDecoration: task.status === 'DONE' ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{task.title}</Typography>
                  <Typography sx={caption}>
                    {task.assignee ? <bdi>{personName(task.assignee)}</bdi> : S.taskNoAssignee}
                    {task.dueDate ? <> · {S.taskDue} <bdi>{formatDueDate(task.dueDate)}</bdi></> : null}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[1]}px` }}>
                  <Segmented value={task.status} onChange={(v) => p.onTaskStatus(task.id, v)} options={TASK_OPTIONS} />
                  <Button variant="ghost" size="sm" icon="trash" disabled={p.disabled} onPress={() => p.onRemoveTask(task.id)}>{S.taskDeleteButton}</Button>
                </Box>
              </Box>
            ))}
            <Box>
              <Button variant="ghost" size="sm" icon="plus" disabled={p.disabled} onPress={p.onAddTask}>{S.addTaskButton}</Button>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
}
