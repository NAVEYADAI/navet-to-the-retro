// Feature 20 (product-backlog/20-issue-tracking.md): shapes returned by the focus-points endpoints.

export type FocusPointKind = 'IMPROVE' | 'KEEP';
export type FocusPointStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED' | 'MERGED';
export type Trend = 'IMPROVED' | 'DECLINED' | 'SAME';
export type RatingWindow = 'NOT_OPEN' | 'OPEN' | 'CLOSED';
export type TaskStatus = 'OPEN' | 'DONE' | 'DROPPED';

export interface PersonRef {
  id: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface FocusPointTask {
  id: number;
  focusPointId: number;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  closedAt: string | null;
  assignee: PersonRef | null;
  /** Only on `/me/focus-point-tasks`. */
  focusPoint?: { id: number; text: string; teamId: number; team: { id: number; name: string } };
}

export interface HistoryEntry {
  sprintId: number | null;
  sprintName: string | null;
  endedAt: string;
  closed: boolean;
  raterCount: number;
  average: number | null;
  valid: boolean;
  trend: Trend | null;
}

export interface FocusPoint {
  id: number;
  kind: FocusPointKind;
  text: string;
  status: FocusPointStatus;
  initialScore: number | null;
  watchSprintsLeft: number | null;
  mentionCount: number;
  sources: { id: number; content: string; type: 'KEEP' | 'IMPROVE'; sprintId: number }[];
  proposalCount: number;
  mergedFromCount: number;
  selectedSprintIds: number[];
  currentScore: number | null;
  history: HistoryEntry[];
  tasks: FocusPointTask[];
}

export interface PoolData {
  quota: number;
  activeMembers: number;
  resultsHidden: boolean;
  points: FocusPoint[];
}

export interface Proposal {
  commentId: number;
  content: string;
  type: 'KEEP' | 'IMPROVE';
  category: string | null;
  sprintId: number;
  sprintName: string;
  proposerCount: number;
}

export interface SprintFocusView {
  window: RatingWindow;
  points: { id: number; text: string; myRating: { score: number; reason: string | null } | null }[];
}

/** What the point form hands back. */
export interface PointFormValues {
  kind: FocusPointKind;
  text: string;
  initialScore: number;
}

export interface PointDraft {
  text: string;
  sourceCommentId: number;
}
