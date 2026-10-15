/**
 * @jest-environment jsdom
 *
 * Feature 21 §21.0 #13: the settings "התחלה מהירה" card (web) — the way back to a hidden checklist.
 */
import React from 'react';
import axios from 'axios';
import { QuickStartCard } from '../quick-start-card';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
// The onboarding barrel pulls in navigation helpers; this card never navigates.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/sprint-routes', () => ({ openFocusPoints: jest.fn() }));
jest.mock('@/context/auth-context', () => ({ useAuth: () => ({ token: 'tok' }) }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const S = Strings.onboarding;
let mounted: Mounted | null = null;
let server: { checklistDismissed: boolean; checklistComplete: boolean };

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  server = { checklistDismissed: true, checklistComplete: false };
  mockedAxios.get.mockImplementation(() => Promise.resolve({ data: { track: 'MEMBER', steps: [], unseenFeatureKeys: [], ...server } }));
  mockedAxios.post.mockImplementation(() => { server.checklistDismissed = false; return Promise.resolve({ data: {} }); });
});
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('QuickStartCard (web)', () => {
  it('a hidden checklist shows "הצג שוב"; pressing it restores (POST), tracks, and the card flips to the visible text', async () => {
    mounted = await mountWeb(<QuickStartCard />);
    const c = mounted.container;
    expect(c.textContent).toContain(S.quickStartTitle);
    expect(c.textContent).toContain(S.quickStartDismissedText);
    await clickText(c, S.quickStartRestoreButton);
    expect(trackEvent).toHaveBeenCalledWith('onboarding_restore_clicked', { screen: 'settings' });
    expect(trackEvent).toHaveBeenCalledWith('onboarding_checklist_restored');
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/onboarding/restore-checklist'), {}, expect.anything());
    expect(c.textContent).toContain(S.quickStartVisibleText);
    expect(c.textContent).not.toContain(S.quickStartRestoreButton);
  });

  it('a visible checklist has no restore button; a finished one says there is nothing to show', async () => {
    server.checklistDismissed = false;
    mounted = await mountWeb(<QuickStartCard />);
    expect(mounted.container.textContent).toContain(S.quickStartVisibleText);
    expect(mounted.container.textContent).not.toContain(S.quickStartRestoreButton);
    mounted.unmount();
    server.checklistComplete = true;
    mounted = await mountWeb(<QuickStartCard />);
    expect(mounted.container.textContent).toContain(S.quickStartCompleteText);
  });

  it('renders nothing when the status could not be loaded', async () => {
    mockedAxios.get.mockRejectedValue(new Error('x'));
    mounted = await mountWeb(<QuickStartCard />);
    expect(mounted.container.textContent).toBe('');
  });
});
