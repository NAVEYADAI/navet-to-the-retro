import React, { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Modal } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { errorMessage } from '../focus-points-logic';
import type { TaskInput } from '../hooks/use-focus-points-admin';

const S = Strings.focusPoints;

interface TaskFormWebProps {
  open: boolean;
  assignees: { userId: number; label: string }[];
  onSubmit: (input: TaskInput) => Promise<void>;
  onClose: () => void;
}

export function TaskFormWeb({ open, assignees, onSubmit, onClose }: TaskFormWebProps) {
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
      await onSubmit({ title: title.trim(), assigneeId: assignee ? Number(assignee) : null, dueDate: due });
    } catch (err: any) {
      trackEvent('focus_point_task_form_submit_failed', { mode: 'create', status: err?.response?.status ?? 0 });
      setError(errorMessage(err, S.saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={abandon} title={S.addTaskButton} closeLabel={S.closeLabel}>
      {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
      <Field type="textarea" rows={2} label={S.taskTitleLabel} value={title} onChangeText={setTitle} required />
      <Field
        type="select"
        label={S.taskAssigneeLabel}
        value={assignee}
        onChangeText={setAssignee}
        options={[{ value: '', label: S.taskNoAssignee }, ...assignees.map((a) => ({ value: String(a.userId), label: a.label }))]}
      />
      <Field type="date" label={S.taskDueLabel} value={due} onChangeText={setDue} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px`, justifyContent: 'flex-end' }}>
        <Button variant="primary" onPress={submit} disabled={isSaving} loading={isSaving}>{S.taskCreateButton}</Button>
        <Button variant="secondary" onPress={abandon} disabled={isSaving}>{S.cancelButton}</Button>
      </Box>
    </Modal>
  );
}
