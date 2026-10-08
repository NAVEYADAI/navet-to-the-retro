import { test, expect, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Runs only against the isolated e2e backend (5006) — see playwright.config.ts.
const BACKEND_URL = 'http://localhost:5006';

async function registerThroughUi(page: Page, email: string) {
  await page.goto('/');
  await page.getByText(Strings.auth.toggleToSignUp).click();
  await page.getByPlaceholder(Strings.auth.emailPlaceholder).fill(email);
  await page.getByPlaceholder(Strings.auth.passwordPlaceholder).fill('password123');
  await page.getByRole('button', { name: Strings.auth.signUpButton }).click();
}

test.describe('Auth — registration + expired-session handling', () => {
  test('BUG-07: two users whose emails share a local-part can both register', async ({ browser }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const local = `e2e_dana_${suffix}`;

    for (const domain of ['a.example.com', 'b.example.com']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await registerThroughUi(page, `${local}@${domain}`);
      // Logged in = the auth form is gone and the dashboard's refresh button is shown.
      await expect(page.getByText(Strings.common.refreshButton).first()).toBeVisible();
      await context.close();
    }
  });

  test('registering an existing email shows the Hebrew "email exists" message', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const email = `e2e_dup_${suffix}@example.com`;
    await request.post(`${BACKEND_URL}/auth/register`, { data: { email, password: 'password123' } });

    await registerThroughUi(page, email);
    await expect(page.getByText(Strings.auth.emailExistsError)).toBeVisible();
  });

  test('BUG-08: a 401 on an authenticated request mid-session returns to the login form', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { email: `e2e_expiry_${suffix}@example.com`, password: 'password123' },
    });
    const { accessToken } = await res.json();

    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('userToken', t), accessToken);
    await page.reload();
    await expect(page.getByText(Strings.common.refreshButton).first()).toBeVisible();

    // Simulate the JWT expiring while the tab stays open.
    await page.route('**/teams/user/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid token' }) })
    );
    await page.getByText(Strings.common.refreshButton).first().click();

    await expect(page.getByText(Strings.auth.loginButton).first()).toBeVisible();
    await expect(page.getByText(Strings.dashboard.createFirstTeamTitle)).toHaveCount(0);
  });

  test('a non-401 load failure shows an error instead of the empty-team state', async ({ page, request }) => {
    const suffix = `${Date.now()}_${test.info().project.name.replace(/\s+/g, '')}`;
    const res = await request.post(`${BACKEND_URL}/auth/register`, {
      data: { email: `e2e_loaderr_${suffix}@example.com`, password: 'password123' },
    });
    const { accessToken } = await res.json();

    await page.route('**/teams/user/me', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('userToken', t), accessToken);
    await page.reload();

    await expect(page.getByText(Strings.dashboard.teamsLoadError)).toBeVisible();
    await expect(page.getByText('אינך חבר באף צוות פיתוח עדיין', { exact: false })).toHaveCount(0);
  });
});
