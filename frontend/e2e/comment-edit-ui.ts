import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Shared setup + selectors for the feature-13 specs (comment edit / delete, write window, extensions,
// deleted-comments panel). API calls are plain fetches against the isolated backend (5006) — never 5005.

export const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts) —
// safe here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';
const DAY = 24 * 60 * 60 * 1000;

export type Actor = { token: string; id: number; username: string };

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A calendar date in Asia/Jerusalem (the zone the backend computes the write window in), shifted by `offset` days. */
export function israelDay(offset = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
}

export async function registerUser(request: APIRequestContext, username: string): Promise<Actor> {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email: `${username}@example.com`, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username };
}

// The approver allowlist is one fixed address shared by every spec in a run: the first registers it, the rest log in.
async function approverToken(request: APIRequestContext, usernameIfNew: string): Promise<string> {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) return (await registerRes.json()).accessToken as string;
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return (await loginRes.json()).accessToken as string;
}

export interface CommentTeam {
  teamId: number;
  teamName: string;
  leader: Actor; // creator = TEAM_LEADER + admin
  members: Actor[]; // plain active DEVELOPER members, joined through an invite
  outsider: Actor; // registered, not in the team
  categoryId: (key: 'TESTING' | 'PLANNING') => number;
}

/** An approved team with a leader (admin), `memberCount` plain members and an outsider. */
export async function createCommentTeam(request: APIRequestContext, suffix: string, memberCount = 2): Promise<CommentTeam> {
  const leader = await registerUser(request, `e2e_pw_ced_leader_${suffix}`);
  const members: Actor[] = [];
  for (let i = 1; i <= memberCount; i++) members.push(await registerUser(request, `e2e_pw_ced_m${i}_${suffix}`));
  const outsider = await registerUser(request, `e2e_pw_ced_out_${suffix}`);
  const approver = await approverToken(request, `e2e_pw_ced_approver_${suffix}`);

  const teamName = `E2E Edit Team ${suffix}`;
  const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leader.token), data: { name: teamName, approverEmail: APPROVER_EMAIL } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver) });

  for (const member of members) {
    const invite = await (await request.post(`${BACKEND_URL}/teams/${team.id}/invites`, { headers: auth(leader.token), data: {} })).json();
    const res = await request.post(`${BACKEND_URL}/invites/${invite.token}/consume`, { headers: auth(member.token) });
    expect(res.ok()).toBeTruthy();
  }

  const categories = await (await request.get(`${BACKEND_URL}/teams/${team.id}/categories`, { headers: auth(leader.token) })).json();
  const categoryId = (key: 'TESTING' | 'PLANNING') => {
    const id = categories.find((c: any) => c.label === Strings.retroBoard.categories[key])?.id;
    expect(id).toBeTruthy();
    return id as number;
  };
  return { teamId: team.id, teamName, leader, members, outsider, categoryId };
}

/** Dates are calendar days relative to today in Israel; negative = in the past. */
export async function createSprint(request: APIRequestContext, ctx: CommentTeam, name: string, startOffset: number, endOffset: number): Promise<number> {
  const res = await request.post(`${BACKEND_URL}/teams/${ctx.teamId}/sprints`, {
    headers: auth(ctx.leader.token),
    data: { name, startDate: israelDay(startOffset), endDate: israelDay(endOffset) },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}

/** Moves a sprint's dates (used to age a sprint after its comments were written while it was open). */
export async function setSprintDates(request: APIRequestContext, ctx: CommentTeam, sprintId: number, startOffset: number, endOffset: number) {
  const res = await request.patch(`${BACKEND_URL}/teams/${ctx.teamId}/sprints/${sprintId}`, {
    headers: auth(ctx.leader.token),
    data: { startDate: israelDay(startOffset), endDate: israelDay(endOffset) },
  });
  expect(res.ok()).toBeTruthy();
}

export async function postComment(
  request: APIRequestContext,
  token: string,
  sprintId: number,
  data: { content: string; type: 'KEEP' | 'IMPROVE'; categoryId?: number; isAnonymous?: boolean },
) {
  const res = await request.post(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(token), data: { isAnonymous: false, ...data } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as { id: number };
}

export async function listComments(request: APIRequestContext, token: string, sprintId: number): Promise<any[]> {
  const res = await request.get(`${BACKEND_URL}/sprints/${sprintId}/comments`, { headers: auth(token) });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** Logs in through localStorage and opens a sprint board directly (the board is a route). */
export async function openBoard(page: Page, token: string, teamId: number, sprintId: number) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto(`/team/${teamId}/sprint/${sprintId}`);
  await expect(page.getByText(Strings.retroBoard.keepLabel, { exact: true }).first()).toBeVisible();
}

/** The padding box of the comment card whose text is `content` (the deepest div containing it). */
export const commentCard = (page: Page, content: string): Locator =>
  page.locator('div').filter({ has: page.getByText(content, { exact: true }) }).last();

export const commentMenuButton = (scope: Page | Locator) => scope.getByRole('button', { name: Strings.retroBoard.commentMenuLabel });

/** Opens a card's "⋯" menu and picks an item by its Hebrew label. */
export async function pickCommentMenuItem(page: Page, content: string, item: string) {
  await commentMenuButton(commentCard(page, content)).click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** Which board column a card sits in: reads the column header text (works for the 2-column and stacked layouts). */
export async function columnLabelOf(card: Locator): Promise<string> {
  return card.evaluate((el) => {
    let node: HTMLElement = el as HTMLElement;
    while (node.parentElement && getComputedStyle(node.parentElement).display !== 'grid') node = node.parentElement;
    return (node.firstElementChild?.textContent || '').trim();
  });
}

/** The header row of an admin panel card (title + its "פתח"/"סגור" button). */
export const panelHeader = (page: Page, title: string) => page.getByText(title, { exact: true }).locator('xpath=..');

export const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** A `<Field>` by its visible label (the label is a sibling element, not wired with for/id): the wrapper holding label + control. */
export const fieldOf = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('xpath=..');
