import React, { useEffect, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Badge, Button, Card, Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { ActionItemFormWeb } from './action-item-form-web';
import { ActionItemRowWeb } from './action-item-row-web';
import { PreviousActionItemsStripWeb } from './previous-action-items-strip-web';
import { useTeamActionItems } from '../hooks/use-team-action-items';
import {
  assigneeName, assigneeOptionsFromMembers, diffItemEdit, dueDateToInput, errorMessage,
  itemsBornInSprint, previousOpenItems,
} from '../action-items-logic';
import type { ActionItem, ActionItemDraft, ActionItemFormValues, ActionItemStatus } from '../types';

export interface ActionItemsSectionProps {
  team: { id: number; members?: any[] };
  sprintId: number;
  token: string;
  /** Set when the user pressed "הפוך למשימה" on a comment; the section opens the form prefilled. */
  draft: ActionItemDraft | null;
  onDraftHandled: () => void;
  /** Bumped by the screen's "רענן" button. */
  refreshKey: number;
}

type FormState = { mode: 'create'; draft: ActionItemDraft | null } | { mode: 'edit'; item: ActionItem };

const EMPTY_VALUES: ActionItemFormValues = { title: '', assigneeIds: [], dueDate: '' };

/** The "previous retro" strip + the sprint's own tasks panel + the create/edit form, on the retro board. */
export function ActionItemsSectionWeb({ team, sprintId, token, draft, onDraftHandled, refreshKey }: ActionItemsSectionProps) {
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

  return (
    <>
      {loadError ? <Alert severity="error" sx={{ ...t.type.body }}>{loadError}</Alert> : null}
      {actionError ? <Alert severity="error" sx={{ ...t.type.body }} onClose={() => setActionError(null)}>{actionError}</Alert> : null}

      {previous.length > 0 ? (
        <PreviousActionItemsStripWeb items={previous} disabled={busyId !== null} onSetStatus={(item, status) => setItemStatus(item, status, 'previous_strip')} />
      ) : null}

      {!isLoading && !loadError ? (
        <Card>
          <Box
            component="button"
            type="button"
            aria-expanded={isOpen}
            onClick={() => { setIsOpen((v) => !v); trackEvent('action_items_panel_toggled', { open: !isOpen }); }}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: `${t.space[2]}px`,
              width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: `${t.space[2]}px`, minWidth: 0 }}>
              <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
                {Strings.actionItems.panelTitle}
              </Typography>
              <Badge tone="accent">{Strings.actionItems.panelCount(mine.length)}</Badge>
            </Box>
            <Icon name="chevron-down" size="sm" tone="muted" rotate={isOpen ? 180 : 0} />
          </Box>

          {isOpen ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
              {mine.length === 0 ? (
                <Typography sx={{ ...t.type.body, color: t.color.textSecondary, fontStyle: 'italic' }}>{Strings.actionItems.panelEmpty}</Typography>
              ) : (
                mine.map((item) => (
                  <ActionItemRowWeb
                    key={item.id}
                    item={item}
                    disabled={busyId === item.id}
                    onSetStatus={(status) => setItemStatus(item, status, 'panel')}
                    onEdit={() => openEdit(item)}
                    onRemove={() => run(item.id, () => remove(item.id))}
                  />
                ))
              )}
              <Box>
                <Button variant="secondary" size="sm" icon="plus" onPress={() => openCreate(null)}>
                  {Strings.actionItems.newButton}
                </Button>
              </Box>
            </Box>
          ) : null}
        </Card>
      ) : null}

      <ActionItemFormWeb
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
