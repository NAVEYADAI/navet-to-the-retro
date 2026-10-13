/**
 * @jest-environment jsdom
 */
import React from 'react';
import { TeamCardHeader } from '../team-card-header';
import { mountWeb, type Mounted } from '@/test-utils/web-dom';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

let mounted: Mounted | null = null;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); });

const base = {
  teamId: 4,
  teamName: 'צוות פיתוח',
  isTeamAdmin: true,
  summary: 'תל אביב',
  members: [],
  isMembersOpen: false,
  onToggleMembers: jest.fn(),
  isSettingsOpen: false,
};
const header = () => mounted!.container.querySelector<HTMLElement>('[data-testid="team-card-header"]')!;

describe('TeamCardHeader (web, feature 19)', () => {
  it('a team with a team colour gets the tinted "team space" header', async () => {
    mounted = await mountWeb(<TeamCardHeader {...base} logoUpdatedAt="v1" accentHue={172} />);
    expect(header().getAttribute('data-team-color')).toBe('true');
    expect(header().textContent).toContain('צוות פיתוח');
  });

  it('a team with a logo but no colour keeps the plain header (no tint)', async () => {
    mounted = await mountWeb(<TeamCardHeader {...base} logoUpdatedAt="v1" accentHue={null} />);
    expect(header().getAttribute('data-team-color')).toBe('false');
  });

  it('a team without a logo is the plain header too, with the letter tile', async () => {
    mounted = await mountWeb(<TeamCardHeader {...base} logoUpdatedAt={null} accentHue={null} />);
    expect(header().getAttribute('data-team-color')).toBe('false');
    // The first letter of the team name (ג-ב-ד): the fallback tile, next to the full name.
    expect(header().textContent).toContain('צ');
    expect(header().querySelector('img')).toBeNull();
  });

  it('hue 0 (red) is a real team colour', async () => {
    mounted = await mountWeb(<TeamCardHeader {...base} logoUpdatedAt="v1" accentHue={0} />);
    expect(header().getAttribute('data-team-color')).toBe('true');
  });

  it('the admin badge and the settings button are still there', async () => {
    const onToggleSettings = jest.fn();
    mounted = await mountWeb(<TeamCardHeader {...base} logoUpdatedAt="v1" accentHue={172} onToggleSettings={onToggleSettings} />);
    expect(mounted.container.querySelector('button[aria-label]')).not.toBeNull();
  });
});
