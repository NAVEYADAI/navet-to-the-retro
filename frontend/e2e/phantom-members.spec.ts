import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'naveyadai@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number, username: body.user.username as string };
}

// The approver allowlist is a fixed real email address, so every project/test in a single suite
// run shares the same approver account — the first one registers it, the rest just log in.
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

async function loginViaLocalStorage(page: Page, token: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('userToken', t), token);
  await page.reload();
}

test.describe('Phantom members (product-backlog/09-phantom-members.md)', () => {
  test('admin creates a phantom member, posts on their behalf, sends a conversion link, and the converted account keeps its history', async ({ page, request, browser }) => {
    // This flow spans a lot of ground (team/member/sprint setup, phantom creation, a comment
    // post, switching identities twice, a conversion in a second browser context) — right at the
    // edge of the default 30s budget on a cold run. Same pattern as memory-board.spec.ts.
    test.setTimeout(60_000);
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Phantom Team ${suffix}`;
    const sprintName = `E2E Phantom Sprint ${suffix}`;
    const memberUsername = `e2e_pw_ph_member_${suffix}`;

    // --- Setup via direct API calls ---
    // Team creation makes the creator TEAM_LEADER + admin automatically (teams.service.ts::create).
    const leader = await registerAndLogin(request, `e2e_pw_ph_leader_${suffix}`, `e2e_pw_ph_leader_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_ph_approver_${suffix}`);
    const member = await registerAndLogin(request, memberUsername, `${memberUsername}@example.com`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // A plain DEVELOPER, non-admin/non-leader member — used below to confirm the phantom-only
    // actions are gated on isAdmin/TEAM_LEADER (§9.0 decision #1), and that the "posted on behalf
    // of" indicator is nonetheless visible to them too (§9.0 decision #2).
    const addMemberRes = await request.post(`${BACKEND_URL}/teams/${team.id}/members`, {
      headers: { Authorization: `Bearer ${leader.token}` },
      data: { username: memberUsername, role: 'DEVELOPER' },
    });
    const membership = await addMemberRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/members/${membership.id}/accept`, {
      headers: { Authorization: `Bearer ${member.token}` },
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

    // --- Browser, as the leader: create a phantom member through the real UI ---
    await loginViaLocalStorage(page, leader.token);
    await page.getByText(teamName).waitFor();

    await page.getByText(Strings.teamList.addPhantomMemberToggle).click();
    await page.getByPlaceholder(Strings.teamList.phantomFirstNameLabel).fill('Phanto');
    await page.getByPlaceholder(Strings.teamList.phantomLastNamePlaceholder).fill('Mm');
    await page.getByText(Strings.teamList.addPhantomMemberButton).click();

    // Appears in the member list with the distinguishing "not registered" badge.
    await expect(page.getByText(Strings.teamList.phantomBadge)).toBeVisible();
    await expect(page.getByText('Phanto Mm')).toBeVisible();

    // --- Post a KEEP comment "on behalf of" the phantom ---
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await page.getByText(Strings.retroBoard.writeNoteHeader).waitFor();

    // Default state ("אני"): the identity control (identified / anonymous / on-behalf) is offered.
    await expect(page.getByText(Strings.retroBoard.anonymousToggleHint)).toBeVisible();

    // The identity control is a 3-way Segmented, not a MUI Select — clicking the third option
    // ("on behalf of someone else") opens a small picker instead of committing immediately.
    await page.getByText(Strings.retroBoard.postOnBehalfOtherOption).click();
    await page.getByText('Phanto Mm').click();

    // §9.0 decision #2: the control itself never disappears (unlike the old plain dropdown) —
    // it now shows who it's posting as, right on the segment.
    await expect(page.getByText(Strings.retroBoard.anonymousToggleHint)).toBeVisible();
    await expect(page.getByText(`${Strings.retroBoard.postOnBehalfLabel} Phanto Mm`)).toBeVisible();

    const commentText = `Comment entered on behalf of the phantom, ${suffix}.`;
    await page.getByPlaceholder(Strings.retroBoard.notePlaceholderKeep).fill(commentText);
    await page.getByText(Strings.retroBoard.postNoteButton).click();

    await expect(page.getByText(commentText)).toBeVisible();
    // §9.0 decision #3: the indicator names the SPECIFIC admin who posted it (the leader's
    // display name — just their username here, since no first/last name was set at registration).
    const postedOnBehalfText = Strings.retroBoard.postedOnBehalfIndicator('Phanto Mm', leader.username);
    await expect(page.getByText(postedOnBehalfText)).toBeVisible();

    // --- Browser, as a plain (non-admin, non-leader) team member ---
    // The board is a route now (BUG-33): a reload would stay on it, so go back to the dashboard.
    await page.evaluate((token) => localStorage.setItem('userToken', token), member.token);
    await page.goto('/');
    await page.getByText(teamName).waitFor();

    // §9.0 decision #2: the indicator naming the poster is visible to every team member, not
    // just managers — never masked, unlike isAnonymous.
    await page.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(page.getByText(commentText)).toBeVisible();
    await expect(page.getByText(postedOnBehalfText)).toBeVisible();

    // But the phantom/on-behalf-of admin actions themselves are gated: the third segment option
    // is actually absent from the DOM for a plain member, not just hidden/disabled.
    await expect(page.getByText(Strings.retroBoard.postOnBehalfOtherOption)).toHaveCount(0);
    await page.getByText(Strings.retroBoard.backButton).click();
    await page.getByText(teamName).waitFor();
    await expect(page.getByText(Strings.teamList.addPhantomMemberToggle)).toHaveCount(0);
    await expect(page.getByText(Strings.invites.sendConversionLinkButton)).toHaveCount(0);

    // --- Browser, back as the leader: send a conversion link from the phantom's own card ---
    await page.evaluate((token) => localStorage.setItem('userToken', token), leader.token);
    await page.reload();
    await page.getByText(teamName).waitFor();

    await page.getByText(Strings.invites.sendConversionLinkButton).click();
    await page.getByText(Strings.invites.conversionLinkCreatedText).waitFor();
    const linkText = await page.locator('text=/\\/invite\\//').first().textContent();
    const conversionToken = linkText!.trim().split('/invite/')[1];
    expect(conversionToken).toBeTruthy();

    // --- A clean browser context (nobody logged in) opens the conversion link ---
    const convertContext = await browser.newContext();
    const convertPage = await convertContext.newPage();
    const newUsername = `e2e_pw_ph_converted_${suffix}`;
    const newEmail = `e2e_pw_ph_converted_${suffix}@example.com`;

    await convertPage.goto(`/invite/${conversionToken}`);
    await convertPage.getByText(Strings.invites.phantomConversionTitle(teamName)).waitFor();

    // The phantom's existing display name is pre-filled.
    await expect(convertPage.getByPlaceholder(Strings.auth.firstNamePlaceholder)).toHaveValue('Phanto');
    await expect(convertPage.getByPlaceholder(Strings.auth.lastNamePlaceholder)).toHaveValue('Mm');

    await convertPage.getByPlaceholder(Strings.auth.usernamePlaceholder).fill(newUsername);
    await convertPage.getByPlaceholder(Strings.auth.emailPlaceholder).fill(newEmail);
    await convertPage.getByPlaceholder(Strings.auth.passwordPlaceholder).fill('password123');
    await convertPage.getByText(Strings.invites.phantomConversionSubmitButton).click();

    await convertPage.waitForURL('**/');
    await convertPage.getByText(teamName).waitFor();

    // The old on-behalf comments still display under the same name (authorId unchanged) with the
    // same indicator as before conversion.
    await convertPage.getByText(Strings.sprints.enterRetroButton).first().click();
    await expect(convertPage.getByText(commentText)).toBeVisible();
    await expect(convertPage.getByText(postedOnBehalfText)).toBeVisible();

    await convertContext.close();
  });
});
