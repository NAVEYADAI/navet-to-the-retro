import type { Page } from '@playwright/test';
import { Strings } from '../src/constants/strings';

// The members list is collapsed behind the "חברים · N" pill in the card header, and adding a member
// (existing user / phantom / invite link) happens in one modal opened from inside that list.
const MEMBERS_TOGGLE = new RegExp(`^${Strings.teamList.membersToggleLabel(0).replace('0', '\\d+')}$`);

async function openToggle(page: Page, name: string | RegExp) {
  const button = page.getByRole('button', { name }).first();
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

/** Idempotent: does nothing when the list is already open. */
export async function openMembers(page: Page) {
  await openToggle(page, MEMBERS_TOGGLE);
}

/** The gear button in the card header (admins / team leaders only). Idempotent. */
export async function openTeamSettings(page: Page) {
  await openToggle(page, Strings.teamSettingsPanel.title);
}

/** Role/admin editing, removal and the phantom registration link sit behind a pencil on each row. */
export async function openMemberActions(page: Page, memberName: string) {
  await openMembers(page);
  await openToggle(page, Strings.teamList.manageMemberLabel(memberName));
}

export async function openAddMemberModal(page: Page, tab?: 'existing' | 'phantom' | 'link') {
  await openMembers(page);
  await page.getByText(Strings.teamList.addMemberToggle, { exact: true }).click();
  const label =
    tab === 'phantom' ? Strings.teamList.addMemberTabPhantom
    : tab === 'link' ? Strings.teamList.addMemberTabLink
    : tab === 'existing' ? Strings.teamList.addMemberTabExisting
    : null;
  if (label) await page.getByText(label, { exact: true }).click();
}
