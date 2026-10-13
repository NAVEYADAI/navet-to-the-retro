/**
 * @jest-environment jsdom
 */
import React from 'react';
import { CommentCardWeb } from '../comment-card-web';
import { AppThemeProvider, TeamAccentScope } from '@/design/theme-context';
import { accentSchemes } from '@/design/tokens';
import { SessionTokenContext } from '@/context/session-token-context';
import { mountWeb, type Mounted } from '@/test-utils/web-dom';

// Feature 19 — product-backlog/19-team-logo.md decisions #10 (anonymous marker) and #11 (the
// highlight is a semantic marker, so it keeps the app colour inside the team's colour area).
let mounted: Mounted | null = null;
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); });

const teamLogo = { teamId: 4, name: 'פיתוח', logoUpdatedAt: 'v1' };
const comment = (over: Record<string, unknown> = {}) => ({
  id: 1, content: 'הערה', type: 'KEEP' as const, isAnonymous: false, isHighlighted: false,
  author: { username: 'nave', firstName: 'נוה', lastName: 'ידאי' }, createdAt: '2026-10-13T10:00:00.000Z', ...over,
});
const mount = (el: React.ReactElement) =>
  mountWeb(<AppThemeProvider><SessionTokenContext.Provider value="tok">{el}</SessionTokenContext.Provider></AppThemeProvider>);
const marker = () => mounted!.container.querySelector('[testid="team-logo"]');

describe('CommentCardWeb + team logo (feature 19)', () => {
  it('an anonymous comment carries the team logo marker next to "אנונימי"', async () => {
    mounted = await mount(<CommentCardWeb comment={comment({ isAnonymous: true })} index={0} teamLogo={teamLogo} />);
    expect(marker()).not.toBeNull();
    expect(mounted.container.textContent).toContain('אנונימי');
  });

  it('a named comment never gets the marker (it is an anonymity marker, not an avatar)', async () => {
    mounted = await mount(<CommentCardWeb comment={comment()} index={0} teamLogo={teamLogo} />);
    expect(marker()).toBeNull();
    expect(mounted.container.textContent).toContain('נוה ידאי');
  });

  it('a team without a logo shows no marker and the card is unchanged', async () => {
    mounted = await mount(<CommentCardWeb comment={comment({ isAnonymous: true })} index={0} teamLogo={{ ...teamLogo, logoUpdatedAt: null }} />);
    expect(marker()).toBeNull();
    expect(mounted.container.textContent).toContain('אנונימי');
  });

  it('without the teamLogo prop (callers that do not know the team) nothing changes', async () => {
    mounted = await mount(<CommentCardWeb comment={comment({ isAnonymous: true })} index={0} />);
    expect(marker()).toBeNull();
  });

  it('a highlighted card keeps the APP accent inside the team colour area', async () => {
    mounted = await mount(
      <TeamAccentScope hue={172}>
        <CommentCardWeb comment={comment({ isHighlighted: true })} index={0} />
      </TeamAccentScope>
    );
    const card = mounted.container.firstElementChild as HTMLElement;
    const rgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(getComputedStyle(card).backgroundColor).toBe(rgb(accentSchemes.blue.subtle));
  });
});
