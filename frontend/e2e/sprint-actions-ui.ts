import { expect, type Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// Edit / delete sprint live behind the "⋯" menu in the sprint header (admins only).
export const sprintMoreActionsButton = (page: Page) => page.getByRole('button', { name: Strings.retroBoard.moreActionsLabel });

async function clickSprintMenuItem(page: Page, name: string) {
  await sprintMoreActionsButton(page).click();
  await page.getByRole('menuitem', { name }).click();
}

export const clickEditSprint = (page: Page) => clickSprintMenuItem(page, Strings.retroBoard.editSprintButton);
export const clickDeleteSprint = (page: Page) => clickSprintMenuItem(page, Strings.sprintDeletion.deleteButton);

/** A non-admin gets no menu at all — nothing to edit or delete. */
export async function expectNoSprintManageActions(page: Page) {
  await expect(sprintMoreActionsButton(page)).toHaveCount(0);
}

const SPRINT_TOOLS_TOGGLE = new RegExp(`^${Strings.retroBoard.toolsToggle(0).replace('0', '\\d+')}$`);

/** Summary / focus points / memory game sit behind the collapsed "כלי ספרינט · N" row. Idempotent. */
export async function openSprintTools(page: Page) {
  const toggle = page.getByRole('button', { name: SPRINT_TOOLS_TOGGLE });
  await toggle.waitFor();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}
