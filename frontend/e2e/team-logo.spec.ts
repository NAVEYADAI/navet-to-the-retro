import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import zlib from 'zlib';
import { Strings } from '../src/constants/strings';
import { openTeamSettings } from './team-members-ui';

// Feature 19 (product-backlog/19-team-logo.md) — team logo + team colour, against the isolated e2e
// backend (port 5006, backend/.env.test) — never the real database.
const BACKEND_URL = 'http://localhost:5006';
const APPROVER_EMAIL = 'naveyadai@gmail.com';
const TEAL = { r: 31, g: 164, b: 148 }; // hue ≈ 172°

// --- a real PNG, built in-process (no image library in the frontend) ---
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A non-square (160x100) solid-colour PNG — also exercises the centred-square crop. */
function solidPng({ r, g, b }: { r: number; g: number; b: number }, w = 160, h = 100): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from([r, g, b, 255])))]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, { data: { username, email, password: 'password123' } });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username };
}
async function ensureApprover(request: APIRequestContext, usernameIfNew: string) {
  const reg = await request.post(`${BACKEND_URL}/auth/register`, { data: { username: usernameIfNew, email: APPROVER_EMAIL, password: 'password123' } });
  if (reg.ok()) { const b = await reg.json(); return { token: b.accessToken as string }; }
  const login = await request.post(`${BACKEND_URL}/auth/login`, { data: { username: APPROVER_EMAIL, password: 'password123' } });
  return { token: (await login.json()).accessToken as string };
}
async function loginViaLocalStorage(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** An approved team (leader = admin) with a regular member, a sprint, and optionally a logo already set. */
async function setup(request: APIRequestContext, label: string, withLogo: boolean) {
  const suffix = `${Date.now()}_${label}_${test.info().project.name.replace(/\s+/g, '')}`;
  const leader = await registerAndLogin(request, `e2e_pw_logo_leader_${suffix}`, `e2e_pw_logo_leader_${suffix}@example.com`);
  const member = await registerAndLogin(request, `e2e_pw_logo_member_${suffix}`, `e2e_pw_logo_member_${suffix}@example.com`);
  const approver = await ensureApprover(request, `e2e_pw_logo_approver_${suffix}`);
  const teamName = `E2E Logo Team ${suffix}`;

  const team = await (await request.post(`${BACKEND_URL}/teams`, { headers: auth(leader.token), data: { name: teamName, approverEmail: APPROVER_EMAIL } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, { headers: auth(approver.token) });
  const membership = await (await request.post(`${BACKEND_URL}/teams/${team.id}/members`, { headers: auth(leader.token), data: { username: member.username, role: 'DEVELOPER' } })).json();
  await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, { headers: auth(member.token) });

  const today = new Date();
  const sprint = await (await request.post(`${BACKEND_URL}/teams/${team.id}/sprints`, {
    headers: auth(leader.token),
    data: { name: `E2E Logo Sprint ${suffix}`, startDate: today.toISOString().slice(0, 10), endDate: new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10) },
  })).json();

  if (withLogo) {
    const res = await request.put(`${BACKEND_URL}/teams/${team.id}/logo`, {
      headers: auth(leader.token),
      multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: solidPng(TEAL) }, accentHue: '172' },
    });
    expect(res.ok()).toBeTruthy();
  }
  return { suffix, leader, member, team, teamName, sprint };
}

const header = (page: Page) => page.locator('[data-testid="team-card-header"]');
const teamInfo = async (request: APIRequestContext, token: string, teamId: number) =>
  (await (await request.get(`${BACKEND_URL}/teams/user/me`, { headers: auth(token) })).json()).find((t: any) => t.id === teamId);

test.describe('Team logo (product-backlog/19-team-logo.md)', () => {
  test('an admin uploads a logo through the UI: the header turns into team space, and removing it restores the plain header', async ({ page, request }) => {
    test.setTimeout(90_000);
    const { leader, team, teamName } = await setup(request, 'upload', false);

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'false');

    await openTeamSettings(page);
    await expect(page.getByText(Strings.teamLogo.emptyDescription)).toBeVisible();

    // The picker is expo-image-picker -> a hidden <input type=file>; Playwright answers the chooser.
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: Strings.teamLogo.uploadButton }).click();
    await (await chooser).setFiles({ name: 'team-logo.png', mimeType: 'image/png', buffer: solidPng(TEAL) });

    // Dialog: three preview sizes + the colour found in the logo, pre-selected.
    await expect(page.getByRole('dialog').getByText(Strings.teamLogo.dialogTitle)).toBeVisible();
    await expect(page.locator('[data-testid="team-logo-preview"]')).toHaveCount(3);
    await expect(page.getByRole('button', { name: Strings.teamLogo.colorOptionLabel(1) })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('dialog').getByRole('button', { name: Strings.teamLogo.saveButton }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Saved: the section shows replace/remove + where the colour came from, the header is tinted.
    await expect(page.getByRole('button', { name: Strings.teamLogo.replaceButton })).toBeVisible();
    await expect(page.getByText(Strings.teamLogo.colorFromLogo)).toBeVisible();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'true');
    await expect(header(page).first().locator('img').first()).toBeVisible();

    // Server-side: a 256x256 PNG was stored, with the teal hue.
    const stored = await teamInfo(request, leader.token, team.id);
    expect(stored.logoUpdatedAt).toBeTruthy();
    expect(stored.accentHue).toBeGreaterThanOrEqual(166);
    expect(stored.accentHue).toBeLessThanOrEqual(178);
    const logoRes = await request.get(`${BACKEND_URL}/teams/${team.id}/logo`, { headers: auth(leader.token) });
    expect(logoRes.headers()['content-type']).toContain('image/png');
    const bytes = await logoRes.body();
    expect(bytes.readUInt32BE(16)).toBe(256); // PNG IHDR width
    expect(bytes.readUInt32BE(20)).toBe(256); // PNG IHDR height

    // The tint is the team colour, not the app's blue.
    const bg = await header(page).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('rgb(237, 243, 255)'); // accentSchemes.blue.subtle

    // Remove: asks first, then the header is plain again and the server has nothing.
    await page.getByRole('button', { name: Strings.teamLogo.removeButton }).click();
    await expect(page.getByText(Strings.teamLogo.removeConfirmTitle)).toBeVisible();
    await page.getByRole('button', { name: Strings.teamLogo.removeConfirmButton }).click();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'false');
    await expect(page.getByText(Strings.teamLogo.emptyDescription)).toBeVisible();
    const after = await teamInfo(request, leader.token, team.id);
    expect(after.logoUpdatedAt).toBeNull();
    expect(after.accentHue).toBeNull();
  });

  test('"no team colour" keeps the logo but leaves the header plain, and the colour can be changed back afterwards', async ({ page, request }) => {
    test.setTimeout(90_000);
    const { leader, team, teamName } = await setup(request, 'nocolor', false);

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();
    await openTeamSettings(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: Strings.teamLogo.uploadButton }).click();
    await (await chooser).setFiles({ name: 'team-logo.png', mimeType: 'image/png', buffer: solidPng(TEAL) });

    await page.getByRole('dialog').getByRole('button', { name: Strings.teamLogo.colorNone }).click();
    await page.getByRole('dialog').getByRole('button', { name: Strings.teamLogo.saveButton }).click();

    await expect(page.getByRole('button', { name: Strings.teamLogo.replaceButton })).toBeVisible();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'false');
    expect((await teamInfo(request, leader.token, team.id)).accentHue).toBeNull();

    // Change the colour of the stored logo, without picking a file again.
    await page.getByRole('button', { name: Strings.teamLogo.colorChangeButton }).click();
    await page.getByRole('dialog').getByRole('button', { name: Strings.teamLogo.colorOptionLabel(1) }).click();
    await page.getByRole('dialog').getByRole('button', { name: Strings.teamLogo.saveButton }).click();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'true');
    expect((await teamInfo(request, leader.token, team.id)).accentHue).toBeGreaterThanOrEqual(166);
  });

  test('a file that is not an image shows an error and changes nothing', async ({ page, request }) => {
    const { leader, team, teamName } = await setup(request, 'badfile', false);

    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();
    await openTeamSettings(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: Strings.teamLogo.uploadButton }).click();
    await (await chooser).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });

    await expect(page.getByText(Strings.teamLogo.pickingError)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await teamInfo(request, leader.token, team.id)).logoUpdatedAt).toBeNull();
  });

  test('a regular member sees the team colour and logo everywhere but cannot manage them; the board carries the banner and the anonymity marker', async ({ page, request }) => {
    test.setTimeout(90_000);
    const { member, team, teamName, sprint, suffix } = await setup(request, 'member', true);

    // One anonymous and one named comment, via the API.
    const anonText = `Anonymous note ${suffix}`;
    const namedText = `Named note ${suffix}`;
    for (const [content, isAnonymous] of [[anonText, true], [namedText, false]] as const) {
      const res = await request.post(`${BACKEND_URL}/sprints/${sprint.id}/comments`, {
        headers: auth(member.token),
        data: { content, type: 'KEEP', isAnonymous },
      });
      expect(res.ok()).toBeTruthy();
    }

    await loginViaLocalStorage(page, member.token);
    await page.getByText(teamName).waitFor();
    await expect(header(page).first()).toHaveAttribute('data-team-color', 'true');
    await expect(header(page).first().locator('img').first()).toBeVisible();
    // No gear = no way to reach the logo controls (admins only, §19.0 decision #1).
    await expect(page.getByRole('button', { name: Strings.teamSettingsPanel.title })).toHaveCount(0);

    // Direct API attempts are refused too.
    const put = await request.put(`${BACKEND_URL}/teams/${team.id}/logo`, {
      headers: auth(member.token),
      multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: solidPng(TEAL) } },
    });
    expect(put.status()).toBe(403);
    expect((await request.delete(`${BACKEND_URL}/teams/${team.id}/logo`, { headers: auth(member.token) })).status()).toBe(403);

    // The sprint board is team space: banner on top, anonymity marker only on the anonymous note.
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.locator('[data-testid="team-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-banner"]')).toHaveAttribute('data-team-color', 'true');
    const anonCard = page.getByText(anonText).locator('xpath=ancestor::*[.//bdi][1]');
    await expect(anonCard.locator('[data-testid="team-logo"]')).toHaveCount(1);
    const namedCard = page.getByText(namedText).locator('xpath=ancestor::*[.//bdi][1]');
    await expect(namedCard.locator('[data-testid="team-logo"]')).toHaveCount(0);

  });

  test('the invite page shows the team logo and colour to someone who is not logged in', async ({ page, request }) => {
    const { leader, team, teamName } = await setup(request, 'invite', true);
    const invite = await (await request.post(`${BACKEND_URL}/teams/${team.id}/invites`, { headers: auth(leader.token), data: {} })).json();

    // Public lookup + public image, no Authorization header.
    const info = await (await request.get(`${BACKEND_URL}/invites/${invite.token}`)).json();
    expect(info).toMatchObject({ valid: true, teamName });
    expect(info.logoUpdatedAt).toBeTruthy();
    expect(info.accentHue).toBeGreaterThanOrEqual(166);
    const img = await request.get(`${BACKEND_URL}/invites/${invite.token}/logo`);
    expect(img.status()).toBe(200);

    await page.goto(`/invite/${invite.token}`);
    const banner = page.locator('[data-testid="team-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(Strings.invites.joinTeamPromptText(teamName));
    const logo = banner.locator('img').first();
    await expect(logo).toHaveAttribute('src', new RegExp(`/invites/${invite.token}/logo`));
    await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // A revoked invite stops advertising the logo.
    await request.patch(`${BACKEND_URL}/teams/${team.id}/invites/${invite.id}`, { headers: auth(leader.token), data: { isRevoked: true } });
    expect((await request.get(`${BACKEND_URL}/invites/${invite.token}/logo`)).status()).toBe(404);
  });
});
