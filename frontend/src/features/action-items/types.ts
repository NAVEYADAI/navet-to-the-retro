// Feature 16 (product-backlog/16-action-items.md): shapes returned by the action-items endpoints.

export type ActionItemStatus = 'OPEN' | 'DONE' | 'DROPPED';

export interface ActionItemAssignee {
  id: number;
  userId: number;
  user: { id: number; username: string; firstName?: string | null; lastName?: string | null };
  /** False once the person left the team or deleted their account — shown as "לא בצוות". */
  isActiveMember: boolean;
}

export interface ActionItem {
  id: number;
  teamId: number;
  sprintId: number;
  sourceCommentId: number | null;
  title: string;
  status: ActionItemStatus;
  dueDate: string | null;
  createdById: number | null;
  createdAt: string;
  closedAt: string | null;
  team: { id: number; name: string };
  sprint: { id: number; name: string };
  assignees: ActionItemAssignee[];
}

/** What the create/edit form hands back. `dueDate` is a date-only "YYYY-MM-DD" or '' for none. */
export interface ActionItemFormValues {
  title: string;
  assigneeIds: number[];
  dueDate: string;
}

/** A person the form can assign — an active team member. */
export interface AssigneeOption {
  userId: number;
  label: string;
}

/** A comment the user chose to turn into a task: prefilled title + the link to keep. */
export interface ActionItemDraft {
  title: string;
  sourceCommentId: number;
}
