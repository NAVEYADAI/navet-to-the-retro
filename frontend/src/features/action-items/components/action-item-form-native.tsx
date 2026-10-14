import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Modal } from '@/components/ui';
import { AssigneePickerNative } from './assignee-picker-native';
import { errorMessage, validateTitle } from '../action-items-logic';
import type { ActionItemFormValues, AssigneeOption } from '../types';

function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

interface ActionItemFormNativeProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial: ActionItemFormValues;
  fromComment?: boolean;
  options: AssigneeOption[];
  extraAssignees?: AssigneeOption[];
  onSubmit: (values: ActionItemFormValues) => Promise<void>;
  onClose: () => void;
}

export function ActionItemFormNative({ open, mode, initial, fromComment, options, extraAssignees, onSubmit, onClose }: ActionItemFormNativeProps) {
  const t = useTheme();
  const [title, setTitle] = useState(initial.title);
  const [assigneeIds, setAssigneeIds] = useState<number[]>(initial.assigneeIds);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      await onSubmit({ title: title.trim(), assigneeIds, dueDate: dueDate.trim() });
    } catch (err) {
      setError(errorMessage(err, Strings.actionItems.saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const fieldStyle: TextStyle = {
    ...rnText(t.type.body),
    borderWidth: 1,
    borderRadius: t.radius.field,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[2],
    textAlign: 'right',
    color: t.color.text,
    borderColor: t.color.borderStrong,
    backgroundColor: t.color.surface,
  };
  const labelStyle = [rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' as const }];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? Strings.actionItems.formCreateTitle : Strings.actionItems.formEditTitle}
      subtitle={fromComment ? Strings.actionItems.formFromCommentSubtitle : undefined}
      closeLabel={Strings.actionItems.closeLabel}
    >
      {!!error && <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{error}</Text>}
      <View style={{ gap: t.space[1] }}>
        <Text style={labelStyle}>{`${Strings.actionItems.titleLabel} *`}</Text>
        <TextInput
          accessibilityLabel={Strings.actionItems.titleLabel}
          style={[fieldStyle, { minHeight: 80, textAlignVertical: 'top' }]}
          multiline
          value={title}
          onChangeText={setTitle}
          placeholder={Strings.actionItems.titlePlaceholder}
          placeholderTextColor={t.color.textMuted}
        />
      </View>
      <AssigneePickerNative options={options} selectedIds={assigneeIds} onToggle={toggle} extraSelected={extraAssignees} />
      <View style={{ gap: t.space[1] }}>
        <Text style={labelStyle}>{Strings.actionItems.dueDateLabel}</Text>
        <TextInput
          accessibilityLabel={Strings.actionItems.dueDateLabel}
          style={[fieldStyle, { minHeight: t.layout.minTouchTarget }]}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={t.color.textMuted}
          autoCapitalize="none"
        />
      </View>
      <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
        <TouchableOpacity
          onPress={submit}
          disabled={isSaving}
          style={{ flex: 1, minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, backgroundColor: t.color.accent.base, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? (
            <ActivityIndicator color={t.color.accent.onBase} size="small" />
          ) : (
            <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.accent.onBase }]}>
              {mode === 'create' ? Strings.actionItems.createButton : Strings.actionItems.saveButton}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onClose}
          disabled={isSaving}
          style={{ flex: 1, minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.border }}
        >
          <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>{Strings.actionItems.cancelButton}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
