import { Strings } from '@/constants/strings';
import { formatUserDisplayName } from '@/features/retro/comment-display';
import type { ActionItem, ActionItemAssignee, ActionItemStatus, AssigneeOption } from './types';

// Pure helpers shared by the web and native action-items components.

export const MAX_TITLE_LENGTH = 500;
const DUE_DATE_ZONE = 'Asia/Jerusalem';

export const STATUS_LABELS: Record<ActionItemStatus, string> = {
  OPEN: Strings.actionItems.statusOpen,
  DONE: Strings.actionItems.statusDone,
  DROPPED: Strings.actionItems.statusDropped,
};

/** Open items born in a DIFFERENT sprint than the one on screen — the "previous retro" strip. */
export function previousOpenItems(items: ActionItem[], currentSprintId: number): ActionItem[] {
  return items.filter((item) => item.status === 'OPEN' && item.sprintId !== currentSprintId);
}

/** Everything born in the sprint on screen, any status — the panel's list. */
export function itemsBornInSprint(items: ActionItem[], sprintId: number): ActionItem[] {
  return items.filter((item) => item.sprintId === sprintId);
}

export function assigneeName(assignee: ActionItemAssignee): string {
  return formatUserDisplayName(assignee.user);
}

/** Active members of the team the form may assign (a PENDING invitee can't be an assignee). */
export function assigneeOptionsFromMembers(members: any[] | undefined): AssigneeOption[] {
  return (members || [])
    .filter((m) => m.status !== 'PENDING' && m.user)
    .map((m) => ({ userId: m.userId as number, label: formatUserDisplayName(m.user) }));
}

/** A task due date is the END of its day (Israel time), so it's late only once the day is over. */
export function isOverdue(item: Pick<ActionItem, 'status' | 'dueDate'>, now: Date = new Date()): boolean {
  return item.status === 'OPEN' && !!item.dueDate && new Date(item.dueDate).getTime() < now.getTime();
}

/** "YYYY-MM-DD" for a date input, from the API's ISO string (read in Israel time, like the server). */
export function dueDateToInput(dueDate: string | null): string {
  if (!dueDate) return '';
  return new Date(dueDate).toLocaleDateString('en-CA', { timeZone: DUE_DATE_ZONE });
}

export function draftTitleFromComment(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > MAX_TITLE_LENGTH ? `${trimmed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : trimmed;
}

/** Validation message for the form's title, or null when OK. */
export function validateTitle(title: string): string | null {
  return title.trim() ? null : Strings.actionItems.titleRequiredError;
}

/** Which of the editable fields differ from the item — an edit sends (and tracks) only these. */
export function diffItemEdit(item: ActionItem, values: { title: string; assigneeIds: number[]; dueDate: string }) {
  const patch: { title?: string; assigneeIds?: number[]; dueDate?: string | null } = {};
  const title = values.title.trim();
  if (title !== item.title) patch.title = title;
  const before = item.assignees.map((a) => a.userId).sort((a, b) => a - b);
  const after = [...values.assigneeIds].sort((a, b) => a - b);
  if (before.length !== after.length || before.some((id, i) => id !== after[i])) patch.assigneeIds = values.assigneeIds;
  if (values.dueDate !== dueDateToInput(item.dueDate)) patch.dueDate = values.dueDate || null;
  return patch;
}

export function errorMessage(err: any, fallback: string): string {
  const message = err?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}

/** Due dates are end-of-day Israel time server-side, so they're always shown in that zone. */
export function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('he-IL', { timeZone: DUE_DATE_ZONE });
}
