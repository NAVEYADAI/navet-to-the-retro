/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { InviteLinksPanel } from '../invite-links-panel';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, findByText, setInput, flush, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

let mounted: Mounted | null = null;
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
  delete (document as any).execCommand;
});

const panel = () => <InviteLinksPanel teamId={3} token="tok" />;

describe('InviteLinksPanel (web)', () => {
  it('shows a load error instead of "no links yet" when the list request fails (BUG-34)', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    mounted = await mountWeb(panel());

    expect(findByText(mounted.container, Strings.invites.loadError)).not.toBeNull();
    expect(findByText(mounted.container, Strings.invites.noLinksText)).toBeNull();
  });

  it('blocks maxUses=0 client-side (BUG-32)', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mounted = await mountWeb(panel());
    await clickText(mounted.container, Strings.invites.createLinkButton);

    const numberInput = mounted.container.querySelector<HTMLInputElement>('input[type="number"]')!;
    await setInput(numberInput, '0');
    // The form's own submit button is the second "create link" button now on screen.
    const buttons = Array.from(mounted.container.querySelectorAll('button')).filter((b) => b.textContent?.includes(Strings.invites.createLinkButton));
    const { act } = require('react');
    await act(async () => { buttons[buttons.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();

    expect(findByText(mounted.container, Strings.invites.maxUsesInvalidError)).not.toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('copies an invite via the execCommand fallback when navigator.clipboard is unavailable (BUG-58)', async () => {
    const invite = { id: 1, token: 'tok123', isRevoked: false, expiresAt: null, maxUses: null, useCount: 0 };
    mockedAxios.get.mockResolvedValue({ data: [invite] });
    (document as any).execCommand = jest.fn().mockReturnValue(true);
    expect((navigator as any).clipboard).toBeUndefined();
    mounted = await mountWeb(panel());

    await clickText(mounted.container, Strings.invites.copyLinkButton);

    expect((document as any).execCommand).toHaveBeenCalledWith('copy');
    expect(findByText(mounted.container, Strings.invites.linkCopiedText)).not.toBeNull();
  });

  it('surfaces an error when copying is impossible', async () => {
    const invite = { id: 1, token: 'tok123', isRevoked: false, expiresAt: null, maxUses: null, useCount: 0 };
    mockedAxios.get.mockResolvedValue({ data: [invite] });
    (document as any).execCommand = jest.fn().mockReturnValue(false);
    mounted = await mountWeb(panel());

    await clickText(mounted.container, Strings.invites.copyLinkButton);

    expect(findByText(mounted.container, Strings.invites.copyFailedError)).not.toBeNull();
  });
});
