import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Modal } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { errorMessage } from '../focus-points-logic';
import { ActionButtonNative, LabeledInputNative, PillPickerNative, TextNative } from './native-parts';
import type { TaskInput } from '../hooks/use-focus-points-admin';

const S = Strings.focusPoints;

interface TaskFormNativeProps {
  open: boolean;
  assignees: { userId: number; label: string }[];
  onSubmit: (input: TaskInput) => Promise<void>;
  onClose: () => void;
}

export function TaskFormNative({ open, assignees, onSubmit, onClose }: TaskFormNativeProps) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Closing or cancelling without saving = an abandoned form (a funnel step worth seeing).
  const abandon = () => { trackEvent('focus_point_task_form_abandoned', { mode: 'create' }); onClose(); };

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setAssignee('');
    setDue('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!title.trim()) {
      trackEvent('focus_point_task_form_validation_failed', { mode: 'create' });
      setError(S.textRequiredError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), assigneeId: assignee ? Number(assignee) : null, dueDate: due.trim() });
    } catch (err: any) {
      trackEvent('focus_point_task_form_submit_failed', { mode: 'create', status: err?.response?.status ?? 0 });
      setError(errorMessage(err, S.saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={abandon} title={S.addTaskButton} closeLabel={S.closeLabel}>
      {error ? <TextNative kind="caption" color={t.color.status.danger.fg}>{error}</TextNative> : null}
      <LabeledInputNative label={`${S.taskTitleLabel} *`} value={title} onChangeText={setTitle} multiline />
      <PillPickerNative label={S.taskAssigneeLabel} value={assignee} onChange={setAssignee} options={[{ value: '', label: S.taskNoAssignee }, ...assignees.map((a) => ({ value: String(a.userId), label: a.label }))]} />
      <LabeledInputNative label={S.taskDueLabel} value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" />
      <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
        <View style={{ flex: 1 }}><ActionButtonNative variant="primary" label={S.taskCreateButton} onPress={submit} loading={isSaving} /></View>
        <View style={{ flex: 1 }}><ActionButtonNative label={S.cancelButton} onPress={abandon} disabled={isSaving} /></View>
      </View>
    </Modal>
  );
}
