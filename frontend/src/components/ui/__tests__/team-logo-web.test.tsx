/**
 * @jest-environment jsdom
 */
import React from 'react';
import { mountWeb, flush, type Mounted } from '@/test-utils/web-dom';
import { SessionTokenContext } from '@/context/session-token-context';

// Metro picks team-logo.tsx on web; jest-expo resolves the .native variant by default, so the web
// component is loaded by its explicit file name.
const { TeamLogo } = require('../team-logo.tsx') as typeof import('../team-logo');

const blob = new Blob(['png'], { type: 'image/png' });
let mounted: Mounted | null = null;
let fetchMock: jest.Mock;
let objectUrlCounter = 0;

// Expo's jest preset installs a lazy global `URL` backed by a module that needs TextEncoder (absent
// in this jsdom). The component only calls URL.createObjectURL, so a minimal stand-in is enough.
const createObjectURL = jest.fn();
Object.defineProperty(globalThis, 'URL', { value: { createObjectURL, revokeObjectURL: jest.fn() }, configurable: true, writable: true });

beforeEach(() => {
  objectUrlCounter += 1;
  fetchMock = jest.fn().mockResolvedValue({ ok: true, blob: async () => blob });
  (global as any).fetch = fetchMock;
  createObjectURL.mockImplementation(() => `blob:logo-${objectUrlCounter}`);
});
afterEach(() => { mounted?.unmount(); mounted = null; });

const withToken = (el: React.ReactElement, token: string | null = 'tok') => (
  <SessionTokenContext.Provider value={token}>{el}</SessionTokenContext.Provider>
);
const img = () => mounted!.container.querySelector('img');

describe('TeamLogo (web, feature 19)', () => {
  it('without a logo shows the letter fallback and never touches the network', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={1} name="פיתוח" logoUpdatedAt={null} />));
    expect(mounted.container.querySelector('[data-testid="team-logo-fallback"]')?.textContent).toBe('פ');
    expect(img()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the image with the session token and the version, and shows it', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={4} name="פיתוח" logoUpdatedAt="2026-10-13T10:00:00.000Z" />));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/teams/4/logo?v=2026-10-13T10%3A00%3A00.000Z');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
    expect(img()?.getAttribute('src')).toMatch(/^blob:logo-/);
    expect(mounted.container.querySelector('[data-testid="team-logo"]')).not.toBeNull();
  });

  it('shares one fetch between several logos of the same team + version', async () => {
    mounted = await mountWeb(withToken(
      <>
        <TeamLogo teamId={5} name="א" logoUpdatedAt="v1" />
        <TeamLogo teamId={5} name="א" logoUpdatedAt="v1" size="lg" />
      </>
    ));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a new logoUpdatedAt is a new fetch (the old bytes are immutable per version)', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={6} name="א" logoUpdatedAt="v1" />));
    await flush();
    await mounted.rerender(withToken(<TeamLogo teamId={6} name="א" logoUpdatedAt="v2" />));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('?v=v2');
  });

  it('falls back to the letter tile when the fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    mounted = await mountWeb(withToken(<TeamLogo teamId={7} name="פיתוח" logoUpdatedAt="v-fail" />));
    await flush();
    expect(mounted.container.querySelector('[data-testid="team-logo-fallback"]')).not.toBeNull();
    expect(img()).toBeNull();
  });

  it('does not fetch (and shows the fallback) when there is no session', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={8} name="פיתוח" logoUpdatedAt="v1" />, null));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(img()).toBeNull();
  });

  it('an invite token loads the public URL directly: no fetch, no Authorization header', async () => {
    mounted = await mountWeb(<TeamLogo teamId={0} name="פיתוח" logoUpdatedAt="v1" inviteToken="abc_DEF-123" />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(img()?.getAttribute('src')).toContain('/invites/abc_DEF-123/logo?v=v1');
  });

  it('marker renders nothing without a logo (the word "אנונימי" is already on the card)', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={9} name="פיתוח" logoUpdatedAt={null} marker />));
    expect(mounted.container.innerHTML).toBe('');
  });

  it('marker with a logo is the small framed image', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={10} name="פיתוח" logoUpdatedAt="v1" marker />));
    await flush();
    const frame = mounted.container.querySelector<HTMLElement>('[data-testid="team-logo"]')!;
    expect(getComputedStyle(frame).width).toBe('20px');
  });

  it('watermark is a bare decorative image (aria-hidden, no frame) and absent without a logo', async () => {
    mounted = await mountWeb(withToken(<TeamLogo teamId={11} name="פיתוח" logoUpdatedAt="v1" watermark />));
    await flush();
    const wm = mounted.container.querySelector('[data-testid="team-logo-watermark"]');
    expect(wm?.getAttribute('aria-hidden')).toBe('true');
    expect(mounted.container.querySelector('[data-testid="team-logo"]')).toBeNull();

    mounted.unmount();
    mounted = await mountWeb(withToken(<TeamLogo teamId={12} name="פיתוח" logoUpdatedAt={null} watermark />));
    expect(mounted.container.innerHTML).toBe('');
  });
});
