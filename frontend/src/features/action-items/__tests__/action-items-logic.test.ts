import {
  assigneeOptionsFromMembers, diffItemEdit, draftTitleFromComment, dueDateToInput, formatDueDate,
  isOverdue, itemsBornInSprint, MAX_TITLE_LENGTH, previousOpenItems, validateTitle,
} from '../action-items-logic';
import { Strings } from '@/constants/strings';
import type { ActionItem } from '../types';

const item = (overrides: Partial<ActionItem> = {}): ActionItem => ({
  id: 1, teamId: 1, sprintId: 5, sourceCommentId: null, title: 'משימה', status: 'OPEN', dueDate: null,
  createdById: 1, createdAt: '2026-10-01T00:00:00.000Z', closedAt: null,
  team: { id: 1, name: 'T' }, sprint: { id: 5, name: 'S5' }, assignees: [], ...overrides,
});
const assignee = (userId: number, isActiveMember = true) => ({
  id: userId, userId, isActiveMember, user: { id: userId, username: `u${userId}` },
});

describe('previousOpenItems / itemsBornInSprint', () => {
  const items = [
    item({ id: 1, sprintId: 4 }),
    item({ id: 2, sprintId: 4, status: 'DONE' }),
    item({ id: 3, sprintId: 5 }),
    item({ id: 4, sprintId: 3, status: 'DROPPED' }),
  ];

  it('previous = open items born in another sprint only', () => {
    expect(previousOpenItems(items, 5).map((i) => i.id)).toEqual([1]);
  });

  it('this sprint = everything born here, any status', () => {
    expect(itemsBornInSprint(items, 5).map((i) => i.id)).toEqual([3]);
    expect(itemsBornInSprint(items, 4).map((i) => i.id)).toEqual([1, 2]);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('is overdue only for an OPEN item whose due date has passed', () => {
    expect(isOverdue(item({ dueDate: '2026-10-13T20:59:59.999Z' }), now)).toBe(true);
    expect(isOverdue(item({ dueDate: '2026-10-14T20:59:59.999Z' }), now)).toBe(false);
    expect(isOverdue(item({ dueDate: null }), now)).toBe(false);
    expect(isOverdue(item({ dueDate: '2026-10-01T00:00:00Z', status: 'DONE' }), now)).toBe(false);
  });
});

describe('due date formatting', () => {
  it('reads the end-of-day Israel timestamp as that same calendar day', () => {
    expect(dueDateToInput('2026-10-20T20:59:59.999Z')).toBe('2026-10-20');
    expect(dueDateToInput('2026-01-20T21:59:59.999Z')).toBe('2026-01-20');
    expect(dueDateToInput(null)).toBe('');
    expect(formatDueDate('2026-10-20T20:59:59.999Z')).toBe('20.10.2026');
  });
});

describe('draftTitleFromComment', () => {
  it('trims, and caps at the backend limit with an ellipsis', () => {
    expect(draftTitleFromComment('  לשפר את ה-CI \n')).toBe('לשפר את ה-CI');
    const long = draftTitleFromComment('א'.repeat(MAX_TITLE_LENGTH + 50));
    expect(long).toHaveLength(MAX_TITLE_LENGTH);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('validateTitle', () => {
  it('rejects blank, accepts text', () => {
    expect(validateTitle('   ')).toBe(Strings.actionItems.titleRequiredError);
    expect(validateTitle('x')).toBeNull();
  });
});

describe('assigneeOptionsFromMembers', () => {
  it('lists non-pending members by display name', () => {
    const members = [
      { userId: 1, status: 'ACTIVE', user: { username: 'a', firstName: 'דנה', lastName: 'לוי' } },
      { userId: 2, status: 'PENDING', user: { username: 'b' } },
      { userId: 3, user: { username: 'c' } },
    ];
    expect(assigneeOptionsFromMembers(members)).toEqual([
      { userId: 1, label: 'דנה לוי' },
      { userId: 3, label: 'c' },
    ]);
    expect(assigneeOptionsFromMembers(undefined)).toEqual([]);
  });
});

describe('diffItemEdit', () => {
  const base = item({ title: 'א', dueDate: '2026-10-20T20:59:59.999Z', assignees: [assignee(1), assignee(2)] });

  it('is empty when nothing changed (assignee order is irrelevant)', () => {
    expect(diffItemEdit(base, { title: ' א ', assigneeIds: [2, 1], dueDate: '2026-10-20' })).toEqual({});
  });

  it('reports only what changed; a cleared date is null', () => {
    expect(diffItemEdit(base, { title: 'ב', assigneeIds: [1, 2], dueDate: '2026-10-20' })).toEqual({ title: 'ב' });
    expect(diffItemEdit(base, { title: 'א', assigneeIds: [1], dueDate: '2026-10-20' })).toEqual({ assigneeIds: [1] });
    expect(diffItemEdit(base, { title: 'א', assigneeIds: [1, 2], dueDate: '' })).toEqual({ dueDate: null });
    expect(diffItemEdit(base, { title: 'א', assigneeIds: [1, 2], dueDate: '2026-11-01' })).toEqual({ dueDate: '2026-11-01' });
  });
});
