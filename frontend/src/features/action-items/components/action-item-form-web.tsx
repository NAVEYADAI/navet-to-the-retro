import React, { useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Modal } from '@/components/ui';
import { AssigneePickerWeb } from './assignee-picker-web';
import { errorMessage, validateTitle } from '../action-items-logic';
import type { ActionItemFormValues, AssigneeOption } from '../types';

interface ActionItemFormWebProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: ActionItemFormValues;
  /** True when the task is being made out of a comment — shown as the form's subtitle. */
  fromComment?: boolean;
  options: AssigneeOption[];
  /** Assignees of the edited item who are no longer active members (kept visible, can be unticked). */
  extraAssignees?: AssigneeOption[];
  /** Resolves when saved; throws to keep the form open with the error shown. */
  onSubmit: (values: ActionItemFormValues) => Promise<void>;
  onClose: () => void;
}

export function ActionItemFormWeb({ open, mode, initial, fromComment, options, extraAssignees, onSubmit, onClose }: ActionItemFormWebProps) {
  const t = useTheme();
  const [title, setTitle] = useState(initial.title);
  const [assigneeIds, setAssigneeIds] = useState<number[]>(initial.assigneeIds);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // A fresh draft / a different item resets the form; closing it leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setAssigneeIds(initial.assigneeIds);
    setDueDate(initial.dueDate);
    setError(null);
  }, [open, initial]);

  const toggle = (userId: number) =>
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const submit = async () => {
    const titleError = validateTitle(title);
    if (titleError) {
      setError(titleError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), assigneeIds, dueDate });
    } catch (err) {
      setError(errorMessage(err, Strings.actionItems.saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? Strings.actionItems.formCreateTitle : Strings.actionItems.formEditTitle}
      subtitle={fromComment ? Strings.actionItems.formFromCommentSubtitle : undefined}
      closeLabel={Strings.actionItems.closeLabel}
    >
      {error ? <Alert severity="error" sx={{ ...t.type.body }}>{error}</Alert> : null}
      <Field
        type="textarea"
        rows={3}
        label={Strings.actionItems.titleLabel}
        placeholder={Strings.actionItems.titlePlaceholder}
        value={title}
        onChangeText={setTitle}
        required
      />
      <AssigneePickerWeb options={options} selectedIds={assigneeIds} onToggle={toggle} extraSelected={extraAssignees} />
      <Field type="date" label={Strings.actionItems.dueDateLabel} value={dueDate} onChangeText={setDueDate} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${t.space[2]}px`, justifyContent: 'flex-end' }}>
        <Button variant="primary" onPress={submit} disabled={isSaving} loading={isSaving}>
          {mode === 'create' ? Strings.actionItems.createButton : Strings.actionItems.saveButton}
        </Button>
        <Button variant="secondary" onPress={onClose} disabled={isSaving}>
          {Strings.actionItems.cancelButton}
        </Button>
      </Box>
    </Modal>
  );
}
