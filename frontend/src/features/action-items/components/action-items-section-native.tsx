import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { ActionItemFormNative } from './action-item-form-native';
import { ActionItemRowNative } from './action-item-row-native';
import { PreviousActionItemsStripNative } from './previous-action-items-strip-native';
import { rnText } from './action-item-meta-native';
import { useTeamActionItems } from '../hooks/use-team-action-items';
import {
  assigneeName, assigneeOptionsFromMembers, diffItemEdit, dueDateToInput, errorMessage,
  itemsBornInSprint, previousOpenItems,
} from '../action-items-logic';
import type { ActionItemsSectionProps } from './action-items-section-web';
import type { ActionItem, ActionItemDraft, ActionItemFormValues, ActionItemStatus } from '../types';

type FormState = { mode: 'create'; draft: ActionItemDraft | null } | { mode: 'edit'; item: ActionItem };

const EMPTY_VALUES: ActionItemFormValues = { title: '', assigneeIds: [], dueDate: '' };

export function ActionItemsSectionNative({ team, sprintId, token, draft, onDraftHandled, refreshKey }: ActionItemsSectionProps) {
  const t = useTheme();
  const { items, isLoading, loadError, refresh, create, setStatus, edit, remove } = useTeamActionItems(team.id, token);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formValues, setFormValues] = useState<ActionItemFormValues>(EMPTY_VALUES);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  const openCreate = (fromDraft: ActionItemDraft | null) => {
    setFormValues({ ...EMPTY_VALUES, title: fromDraft?.title ?? '' });
    setForm({ mode: 'create', draft: fromDraft });
    trackEvent('action_item_form_opened', { fromComment: !!fromDraft });
  };

  useEffect(() => {
    if (!draft) return;
    setIsOpen(true);
    openCreate(draft);
    onDraftHandled();
  }, [draft]);

  const openEdit = (item: ActionItem) => {
    setFormValues({ title: item.title, assigneeIds: item.assignees.map((a) => a.userId), dueDate: dueDateToInput(item.dueDate) });
    setForm({ mode: 'edit', item });
    trackEvent('action_item_edit_opened');
  };

  const run = async (id: number, action: () => Promise<void>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err, Strings.actionItems.updateError));
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (values: ActionItemFormValues) => {
    if (!form) return;
    if (form.mode === 'create') {
      await create(sprintId, { ...values, sourceCommentId: form.draft?.sourceCommentId });
    } else {
      const changes = diffItemEdit(form.item, values);
      if (Object.keys(changes).length > 0) await edit(form.item.id, changes);
    }
    setForm(null);
  };

  const previous = previousOpenItems(items, sprintId);
  const mine = itemsBornInSprint(items, sprintId);
  const setItemStatus = (item: ActionItem, status: ActionItemStatus, source: 'panel' | 'previous_strip') =>
    run(item.id, () => setStatus(item.id, status, source));
  const editedItem = form?.mode === 'edit' ? form.item : null;
  const errorText = (message: string) => (
    <Text style={[rnText(t.type.caption), { color: t.color.status.danger.fg, textAlign: 'right' }]}>{message}</Text>
  );

  return (
    <>
      {!!loadError && errorText(loadError)}
      {!!actionError && errorText(actionError)}

      {previous.length > 0 ? (
        <PreviousActionItemsStripNative items={previous} disabled={busyId !== null} onSetStatus={(item, status) => setItemStatus(item, status, 'previous_strip')} />
      ) : null}

      {!isLoading && !loadError ? (
        <View style={{ gap: t.space[3], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => { setIsOpen((v) => !v); trackEvent('action_items_panel_toggled', { open: !isOpen }); }}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', minHeight: t.layout.minTouchTarget, gap: t.space[2] }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], flexShrink: 1 }}>
              <Text style={[rnText(t.type.cardTitle), { color: t.color.text }]}>{Strings.actionItems.panelTitle}</Text>
              <Text style={[rnText({ ...t.type.caption, fontWeight: 600 }), { color: t.color.accent.base }]}>{Strings.actionItems.panelCount(mine.length)}</Text>
            </View>
            <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
          </TouchableOpacity>

          {isOpen ? (
            <View style={{ gap: t.space[3] }}>
              {mine.length === 0 ? (
                <Text style={[rnText(t.type.body), { color: t.color.textSecondary, textAlign: 'right', fontStyle: 'italic' }]}>{Strings.actionItems.panelEmpty}</Text>
              ) : (
                mine.map((item) => (
                  <ActionItemRowNative
                    key={item.id}
                    item={item}
                    disabled={busyId === item.id}
                    onSetStatus={(status) => setItemStatus(item, status, 'panel')}
                    onEdit={() => openEdit(item)}
                    onRemove={() => run(item.id, () => remove(item.id))}
                  />
                ))
              )}
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => openCreate(null)}
                style={{ minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, borderWidth: 1, borderColor: t.color.borderStrong }}
              >
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.text }]}>{Strings.actionItems.newButton}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      <ActionItemFormNative
        open={form !== null}
        mode={form?.mode ?? 'create'}
        initial={formValues}
        fromComment={form?.mode === 'create' && !!form.draft}
        options={assigneeOptionsFromMembers(team.members)}
        extraAssignees={editedItem ? editedItem.assignees.filter((a) => !a.isActiveMember).map((a) => ({ userId: a.userId, label: assigneeName(a) })) : []}
        onSubmit={handleSubmit}
        onClose={() => setForm(null)}
      />
    </>
  );
}
