import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

const BACKEND_URL = 'http://localhost:5006';
// Team creation only accepts a hardcoded approver allowlist (backend/src/teams/teams.service.ts)
// — safe to use here since this suite only ever runs against the isolated test database.
const APPROVER_EMAIL = 'lironka13@gmail.com';

async function registerAndLogin(request: APIRequestContext, username: string, email: string) {
  const res = await request.post(`${BACKEND_URL}/auth/register`, {
    data: { username, email, password: 'password123' },
  });
  const body = await res.json();
  return { token: body.accessToken as string, id: body.user.id as number };
}

// Shared with retro-comment-filters.spec.ts's pattern: the approver allowlist is a fixed real
// email, so every project/spec in one run shares the same account — register once, log in after.
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

test.describe('Team invites — email invites for unregistered users + shareable join links', () => {
  test('generating a shareable link through the real UI lets a brand-new user join immediately', async ({ page, request, browser }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const teamName = `E2E Invite Team ${suffix}`;

    const creator = await registerAndLogin(request, `e2e_pw_creator_${suffix}`, `e2e_pw_creator_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_approver_${suffix}`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    // Drive the real dashboard UI as the creator/admin to generate the invite link.
    await loginViaLocalStorage(page, creator.token);
    await page.getByText(teamName).waitFor();
    await page.getByText(Strings.invites.manageLinksToggle).click();
    // First click reveals the create-link form (whose submit button reuses the same label);
    // the second click submits it with no expiry/max-uses restrictions.
    await page.getByText(Strings.invites.createLinkButton).click();
    await page.getByText(Strings.invites.createLinkButton).click();

    await page.getByText(Strings.invites.linkCreatedText).waitFor();
    const linkText = await page.locator('text=/\\/invite\\//').first().textContent();
    const inviteToken = linkText!.trim().split('/invite/')[1];
    expect(inviteToken).toBeTruthy();

    // A brand-new person, in a fresh browser context (nobody logged in), opens the link,
    // registers through it, and should land in the team immediately — no accept/decline step.
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();
    const joinerEmail = `e2e_pw_joiner_${suffix}@example.com`;

    await joinerPage.goto(`/invite/${inviteToken}`);
    await joinerPage.getByText(Strings.invites.joinTeamPromptText(teamName)).waitFor();

    await joinerPage.getByText(Strings.auth.toggleToSignUp).click();
    await joinerPage.getByPlaceholder(Strings.auth.emailPlaceholder).fill(joinerEmail);
    // Username input isn't shown on the native register form — auth-form-native derives it from email.
    await joinerPage.getByPlaceholder(Strings.auth.passwordPlaceholder).fill('password123');
    await joinerPage.getByRole('button', { name: Strings.auth.signUpButton }).click();

    await joinerPage.waitForURL('**/');
    await joinerPage.getByText(teamName).waitFor();

    await joinerContext.close();
  });

  test('inviting an unregistered email sends an invite instead of a pending in-app request', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}_email`;
    const teamName = `E2E Email Invite Team ${suffix}`;
    const invitedEmail = `e2e_pw_unregistered_${suffix}@example.com`;

    const creator = await registerAndLogin(request, `e2e_pw_creator2_${suffix}`, `e2e_pw_creator2_${suffix}@example.com`);
    const approver = await ensureApprover(request, `e2e_pw_approver2_${suffix}`);

    const teamRes = await request.post(`${BACKEND_URL}/teams`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { name: teamName, approverEmail: APPROVER_EMAIL },
    });
    const team = await teamRes.json();
    await request.post(`${BACKEND_URL}/teams/${team.id}/approve`, {
      headers: { Authorization: `Bearer ${approver.token}` },
    });

    await loginViaLocalStorage(page, creator.token);
    await page.getByText(teamName).waitFor();
    // The add-member form is collapsed behind this toggle by default (team-card.tsx web).
    await page.getByText('+ הוסף חבר צוות').click();

    await page.getByPlaceholder('הכנס כתובת אימייל').fill(invitedEmail);
    await page.getByText(Strings.teamList.addMemberButton).click();

    await expect(page.getByText(Strings.teamList.emailInviteSentText(invitedEmail))).toBeVisible();
  });
});
