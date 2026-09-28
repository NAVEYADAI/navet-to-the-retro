import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { Strings } from '../src/constants/strings';

// Telegram comment ingestion (product-backlog/10-telegram-comment-ingestion.md §10).
//
// **Stub strategy / real limitation** (spelled out explicitly in §10.3, same shape of problem as
// the Google OAuth e2e limitation documented in google-calendar.spec.ts): there is no way to run a
// real Telegram conversation (bot + chat) in an isolated e2e environment. Instead:
//   - A `UserMessagingLink` row is written directly into the isolated test DB via
//     `backend/scripts/e2e-seed-telegram-link.js` — standing in for a real, HMAC-verified
//     `POST /auth/telegram/link` round-trip through the Telegram Login Widget (which cannot run
//     headlessly here either — it's Telegram's own external script).
//   - The rest of the conversation (team resolve → Keep/Improve → category → comment creation) is
//     driven by calling the real, unmocked `POST /telegram/webhook` endpoint directly with a valid
//     `X-Telegram-Bot-Api-Secret-Token` header (`TELEGRAM_WEBHOOK_SECRET`, set in
//     backend/.env.test specifically to make this possible) and a fake Telegram update payload
//     shaped like `{update_id, message: {chat: {id, type: 'private'}, text}}`. This exercises the
//     *entire* resolve→category→create chain end-to-end, including the real (unmocked)
//     `CommentsService.create` — it just skips the part where a human types into a real Telegram
//     app. Outbound bot replies (`sendMessage`) are not observable from here (`TELEGRAM_BOT_TOKEN`
//     is left unset in `.env.test`, so `TelegramApiService.sendMessage` silently no-ops — see that
//     file) — progress through the conversation is instead verified via the comment actually
//     landing (or not landing) through the real `GET /sprints/:id/comments` endpoint.
//   - The Settings page's Telegram card (rendering, connected/disconnected state, real
//     connect/disconnect side effects for the *seeded* case) is covered through the actual browser
//     UI below. The Telegram Login Widget's own callback (a script telegram.org serves) is not
//     simulated — same explicit carve-out as the widget-load test in §10.3. The native
//     ("open in browser") branch of `telegram-link-card.tsx` is gated on `Platform.OS !== 'web'`,
//     which is never true in a Chromium-based Playwright run (Desktop or Mobile Chrome are both
//     still the Expo *web* build) — there is no way to reach that branch from this suite, the same
//     category of limitation as the widget callback itself.

const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'naveyadai@gmail.com';
const WEBHOOK_SECRET = 'e2e-test-telegram-webhook-secret'; // must match backend/.env.test

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' },
  });
  if (registerRes.ok()) {
    const body = await registerRes.json();
    return { token: body.accessToken as string, id: body.user.id as number };
  }
  const loginRes = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { username: APPROVER_EMAIL, password: 'password123' },
  });
  const body = await loginRes.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

async function loginAndOpenSettings(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.goto('/settings');
  await page.getByText(Strings.settings.pageTitle).waitFor();
}

// The nav bar (app-tabs.web.tsx) also renders a literal "מחובר" label under the logged-in user's
// name (an unrelated "you're logged in" indicator, not part of Strings) — same exact text as
// `Strings.settings.telegramConnectedText`. Every assertion about the Telegram card's own
// connected/disconnected copy must be scoped to the card itself, not the whole page.
function telegramCard(page: Page) {
  return page.getByText(Strings.settings.telegramCardTitle, { exact: true }).locator('xpath=../..');
}

// See file header — writes a `UserMessagingLink` row directly into the isolated test DB, standing
// in for a real Telegram Login Widget round-trip that cannot run here.
function seedTelegramLink(userId: number, externalId: string) {
  execFileSync(
    'npm',
    ['run', '--silent', 'e2e:seed-telegram-link', '--', String(userId), externalId],
    { cwd: path.resolve(__dirname, '../../backend'), stdio: 'inherit' }
  );
}

async function sendWebhookMessage(
  request: APIRequestContext,
  chatId: string,
  text: string,
  updateId: number,
  // No default value here on purpose — a caller passing `undefined` explicitly (to test the
  // "missing header" case) must NOT silently fall back to a default parameter value in JS (which
  // triggers on an explicit `undefined` argument just like an omitted one). Use `null` for "omit
  // the header entirely"; every real call below passes `WEBHOOK_SECRET` explicitly.
  secretToken: string | null
) {
  const headers: Record<string, string> = {};
  if (secretToken !== null) headers['X-Telegram-Bot-Api-Secret-Token'] = secretToken;
  return request.post(`${BACKEND_URL}/telegram/webhook`, {
    headers,
    data: {
      update_id: updateId,
      message: { chat: { id: Number(chatId), type: 'private' }, text },
    },
  });
}

test.describe('Telegram comment ingestion — webhook state machine (product-backlog/10)', () => {
  test('rejects a webhook call with a missing/wrong secret token, and a message from an unlinked chat never creates a comment', async ({ request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;

    // Missing header entirely.
    const missingRes = await sendWebhookMessage(request, '1', 'hello', 1, null);
    expect(missingRes.status()).toBe(401);

    // Wrong secret.
    const wrongRes = await sendWebhookMessage(request, '1', 'hello', 1, 'not-the-real-secret');
    expect(wrongRes.status()).toBe(401);

    // Correct secret, but this chat id has no `UserMessagingLink` at all — must not error and
    // must not create anything; it's a graceful "not linked" no-op (§10.0 decision #8).
    const unlinkedChatId = `unlinked_${suffix}`;
    const okRes = await sendWebhookMessage(request, unlinkedChatId, 'this should never become a comment', 1, WEBHOOK_SECRET);
    expect(okRes.ok()).toBe(true);
    expect(await okRes.json()).toEqual({ ok: true });
  });

  test('a linked user\'s free-text message, Keep/Improve answer, and category choice create a real comment through CommentsService.create — a Telegram retry of the same update_id does not duplicate it', async ({ request }) => {
    test.setTimeout(60_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Telegram Team ${suffix}`;
    const sprintName = `E2E Telegram Sprint ${suffix}`;
    const chatId = `${Date.now()}${Math.floor(Math.random() * 1000)}`; // fake numeric Telegram chat id, unique per run

    const leader = await registerAndLogin(request, `e2e_pw_tg_leader_${suffix}`, `e2e_pw_tg_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_tg_approver_${suffix}`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: {
        name: sprintName,
        startDate: today.toISOString().slice(0, 10),
        endDate: twoWeeksOut.toISOString().slice(0, 10),
      },
    });
    const sprint = await sprintRes.json();

    // Real category, from the team's own (auto-seeded, §3.1) enabled category list — the bot must
    // present/accept exactly this list, not some Telegram-specific duplicate of it.
    const categoriesRes = await request.get(`${BACKEND_URL}/teams/${team.id}/categories?enabledOnly=true`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    const categories = await categoriesRes.json();
    expect(categories.length).toBeGreaterThan(0);
    const targetCategory = categories[1] ?? categories[0]; // pick index 2 in the bot's numbered list below

    seedTelegramLink(leader.id, chatId);

    const commentText = `Telegram-originated comment ${suffix}`;

    // Step 1: fresh free text — single open team+sprint, so this silently resolves the active
    // context AND is itself treated as the pending comment body; the bot asks Keep/Improve next.
    // No comment exists yet.
    const step1 = await sendWebhookMessage(request, chatId, commentText, 101, WEBHOOK_SECRET);
    expect(step1.ok()).toBe(true);
    let commentsRes = await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    expect((await commentsRes.json()).some((c: any) => c.content === commentText)).toBe(false);

    // Step 2: answer "Keep" — stores the type, shows the category list. Still no comment.
    const step2 = await sendWebhookMessage(request, chatId, 'Keep', 102, WEBHOOK_SECRET);
    expect(step2.ok()).toBe(true);
    commentsRes = await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    expect((await commentsRes.json()).some((c: any) => c.content === commentText)).toBe(false);

    // Step 3: answer with the category's 1-based index — creates the comment via the real,
    // unmocked `CommentsService.create`.
    const categoryIndex = categories.indexOf(targetCategory) + 1;
    const step3 = await sendWebhookMessage(request, chatId, String(categoryIndex), 103, WEBHOOK_SECRET);
    expect(step3.ok()).toBe(true);

    commentsRes = await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    const allComments = await commentsRes.json();
    const created = allComments.find((c: any) => c.content === commentText);
    expect(created).toBeTruthy();
    expect(created.type).toBe('KEEP');
    expect(created.category?.id).toBe(targetCategory.id);

    // Telegram retry (identical update_id, e.g. after a Fly suspend/resume) must be a silent
    // no-op — no second comment.
    const retry = await sendWebhookMessage(request, chatId, String(categoryIndex), 103, WEBHOOK_SECRET);
    expect(retry.ok()).toBe(true);
    commentsRes = await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    expect((await commentsRes.json()).filter((c: any) => c.content === commentText)).toHaveLength(1);
  });

  test('a linked user can skip category selection ("דלג") — the comment is created with no category', async ({ request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Telegram Skip Team ${suffix}`;
    const sprintName = `E2E Telegram Skip Sprint ${suffix}`;
    const chatId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const leader = await registerAndLogin(request, `e2e_pw_tg_skip_leader_${suffix}`, `e2e_pw_tg_skip_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_tg_skip_approver_${suffix}`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    const today = new Date();
    const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sprintRes = await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: {
        name: sprintName,
        startDate: today.toISOString().slice(0, 10),
        endDate: twoWeeksOut.toISOString().slice(0, 10),
      },
    });
    const sprint = await sprintRes.json();

    seedTelegramLink(leader.id, chatId);

    const commentText = `Skip-category Telegram comment ${suffix}`;
    await sendWebhookMessage(request, chatId, commentText, 201, WEBHOOK_SECRET);
    await sendWebhookMessage(request, chatId, 'Improve', 202, WEBHOOK_SECRET);
    await sendWebhookMessage(request, chatId, 'דלג', 203, WEBHOOK_SECRET);

    const commentsRes = await request.get(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
      headers: { Authorization: `Bearer ${leader.token}` },
    });
    const created = (await commentsRes.json()).find((c: any) => c.content === commentText);
    expect(created).toBeTruthy();
    expect(created.type).toBe('IMPROVE');
    expect(created.category).toBeNull();
  });
});

test.describe('Telegram integration — settings card (product-backlog/10)', () => {
  test('a plain (non-admin) team member sees the Telegram card, not connected by default, with the widget-unavailable notice (no bot configured in e2e)', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Telegram Settings Team ${suffix}`;
    const memberUsername = `e2e_pw_tg_member_${suffix}`;

    const admin = await registerAndLogin(request, `e2e_pw_tg_admin_${suffix}`, `e2e_pw_tg_admin_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_tg_settings_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });

    await loginAndOpenSettings(page, member.token);

    const card = telegramCard(page);
    await expect(page.getByText(Strings.settings.telegramCardTitle, { exact: true })).toBeVisible();
    await expect(card.getByText(Strings.settings.telegramNotConnectedText)).toBeVisible();
    // EXPO_PUBLIC_TELEGRAM_BOT_USERNAME is forced empty in this e2e environment (the `web:e2e`
    // script in frontend/package.json overrides the real value in frontend/.env) — the widget
    // script must not be injected at all, only the "not configured" notice.
    await expect(card.getByText(Strings.settings.telegramWidgetUnavailableText)).toBeVisible();
    await expect(page.locator('script[src*="telegram-widget.js"]')).toHaveCount(0);
    // Not connected — the "connected" text/disconnect button must genuinely not be in the DOM
    // (scoped to the card — the nav bar has its own unrelated, identically-worded "מחובר" label).
    await expect(card.getByText(Strings.settings.telegramConnectedText, { exact: true })).toHaveCount(0);
    await expect(card.getByRole('button', { name: Strings.settings.telegramDisconnectButton })).toHaveCount(0);
  });

  test('a user with an existing Telegram link (seeded — see file header) sees "connected" status, and disconnecting through the real endpoint flips it back', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const username = `e2e_pw_tg_solo_${suffix}`;
    const chatId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const user = await registerAndLogin(request, username, `${username}@example.com`);
    seedTelegramLink(user.id, chatId);

    await loginAndOpenSettings(page, user.token);

    const card = telegramCard(page);
    await expect(card.getByText(Strings.settings.telegramConnectedText, { exact: true })).toBeVisible();
    const disconnectButton = card.getByRole('button', { name: Strings.settings.telegramDisconnectButton });
    await expect(disconnectButton).toBeVisible();
    // The "not connected"/widget-unavailable copy must not also be present while connected.
    await expect(card.getByText(Strings.settings.telegramNotConnectedText)).toHaveCount(0);

    await disconnectButton.click();

    await expect(card.getByText(Strings.settings.telegramUnlinkedMessage)).toBeVisible();
    await expect(card.getByText(Strings.settings.telegramNotConnectedText)).toBeVisible();
    await expect(card.getByRole('button', { name: Strings.settings.telegramDisconnectButton })).toHaveCount(0);

    // Confirm it's really persisted server-side (real endpoint, not just local state).
    const statusRes = await request.get(`${BACKEND_URL}/auth/telegram/link/status`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(await statusRes.json()).toEqual({ connected: false });
  });
});
