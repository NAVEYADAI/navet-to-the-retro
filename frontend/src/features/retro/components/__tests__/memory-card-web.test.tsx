/**
 * @jest-environment jsdom
 *
 * MemoryCardWeb is a web-only (MUI + framer-motion) component, unlike the other components under
 * this __tests__ directory that render through @testing-library/react-native's react-test-renderer.
 * There is no `@testing-library/react` in this repo (only /react-native, /jest-dom, /user-event),
 * so this file mounts directly via react-dom/client + `act`, dispatching real DOM MouseEvents —
 * the jsdom environment override (docblock above) gives it a real `document` for Emotion/MUI to
 * use, which the default jest-expo/node testEnvironment does not provide.
 *
 * IMPORTANT gotcha discovered while writing this: `jest/framer-motion-mock.js` (the repo-wide
 * `framer-motion` mock, used so `motion.div`/`AnimatePresence` don't crash in Jest) resolves
 * `motion.div` via a `Proxy` `get` trap that constructs a brand-new `React.forwardRef(...)`
 * component on every property access — i.e. a structurally new component *type* on every render
 * of a component that renders `<motion.div>`. React treats a changed element type as "different
 * component" and unmounts+remounts the DOM node, so a real `<motion.div>` element captured once
 * (e.g. via `querySelector`) goes stale/detached after ANY state update that re-renders it — a
 * click dispatched on the stale node silently does nothing (it can't bubble to the React root
 * listener because it's disconnected from the document). This is purely a mock artifact (real
 * framer-motion's `motion.div` is a stable, memoized component) — NOT a production bug — but it
 * means every interaction below re-queries the live element via `getCard()` instead of holding
 * onto one reference across state-changing steps.
 *
 * Enlarged-state assertions below check `zIndex` (still a plain `style` prop), not `width` —
 * the enlarge width/height is driven through framer-motion's `animate` prop (deliberately, not
 * `style` — see the code comment in memory-card-web.tsx on why), and the mock above strips
 * `animate` out entirely (it's one of the props destructured away before spreading to the real
 * DOM element), so a real browser reflects the enlarged width but this mocked test cannot
 * observe it via `style.width`.
 *
 * Same real-DOM-vs-mock gap applies to `<Image>` from `react-native`: in the real Expo web build,
 * Metro resolves `react-native` to `react-native-web`, whose `Image` compiles to a real `<img>`.
 * Under this jest preset there's no such resolution (and `jest.mock('react-native', ...)` isn't a
 * safe way to fix it either — `jest.requireActual('react-native')` bypasses jest-expo's own native-
 * module mocking and crashes on `TurboModuleRegistry`/`DevMenu`), so `Image` stays the native
 * primitive. Rendered through raw react-dom (rather than react-test-renderer, which the rest of
 * this repo's tests use and which doesn't validate against real DOM tag/attribute rules), it logs
 * noisy-but-inert "unrecognized tag"/"unrecognized prop" console errors — filtered out below so
 * this suite's output stays readable. Has no bearing on the real browser's rendering.
 */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryCardWeb, type MemoryCardWebComment } from '../memory-card-web';
import { Strings } from '@/constants/strings';

const KNOWN_IMAGE_MOCK_NOISE = [
  'is unrecognized in this browser',
  // React logs this as a format string ("...the `%s` prop...") with the prop name as a separate
  // arg, not interpolated into args[0] — match the stable part only.
  'does not recognize the `%s` prop on a DOM element',
  'is using incorrect casing',
];

let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  const realConsoleError = console.error.bind(console);
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && KNOWN_IMAGE_MOCK_NOISE.some(pattern => (args[0] as string).includes(pattern))) return;
    realConsoleError(...args);
  });
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.2): the
// label comes straight off the API-joined category object now, not a Strings lookup by enum key —
// reusing the seed label text here purely for readability, not because it's looked up that way.
const categoryLabel = Strings.retroBoard.categories.TESTING;

const baseComment: MemoryCardWebComment = {
  id: 1,
  content: 'The demo went really well this sprint.',
  type: 'KEEP',
  category: { id: 5, label: categoryLabel },
  isAnonymous: false,
  author: { username: 'dev1', firstName: 'Dana', lastName: 'Levi' },
  createdAt: '2026-08-04T12:00:00.000Z',
};

let container: HTMLDivElement;
let root: Root;

function mount(comment: MemoryCardWebComment) {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<MemoryCardWeb comment={comment} />);
  });
}

function getCard(): HTMLElement {
  return container.querySelector('[role="button"]') as HTMLElement;
}

function click() {
  act(() => {
    getCard().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function waitPastSingleClickWindow() {
  // handleClick's single/double-click distinction uses a ~220ms timer (memory-card-web.tsx).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('MemoryCardWeb', () => {
  it('starts face-down: no comment content, category or author text in the DOM', () => {
    mount(baseComment);
    expect(container.textContent).not.toContain(baseComment.content);
    expect(container.textContent).not.toContain(categoryLabel);
    expect(container.textContent).not.toContain('Dana');
    expect(getCard().style.zIndex).toBe('1');
  });

  it('a single click flips the card and reveals content, category badge and author name', async () => {
    mount(baseComment);
    click();
    await waitPastSingleClickWindow();

    expect(container.textContent).toContain(baseComment.content);
    expect(container.textContent).toContain(categoryLabel);
    expect(container.textContent).toContain('Dana Levi');
    // Still compact-sized — a single click flips only, it does not enlarge.
    expect(getCard().style.zIndex).toBe('1');
  });

  it('an anonymous comment shows "אנונימי" instead of the real author name once flipped', async () => {
    mount({ ...baseComment, id: 2, isAnonymous: true });
    click();
    await waitPastSingleClickWindow();

    expect(container.textContent).toContain(Strings.retroBoard.anonymousAuthor);
    expect(container.textContent).not.toContain('Dana');
  });

  it('a second click arriving before the single-click timer fires (a double click) also enlarges the card', async () => {
    mount(baseComment);
    click();
    await waitPastSingleClickWindow();
    expect(container.textContent).toContain(baseComment.content); // flipped from the first click

    // Two clicks in immediate succession, before the ~220ms single-click timer of a *new* pending
    // click could fire — matches how a real double-click event sequence (click, click, dblclick)
    // arrives faster than the timer window.
    act(() => {
      const card = getCard();
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(getCard().style.zIndex).toBe('10');
    expect(container.textContent).toContain(baseComment.content); // still flipped, not flipped back
  });

  it('a card with no category renders without a category badge', async () => {
    mount({ ...baseComment, id: 3, category: null });
    click();
    await waitPastSingleClickWindow();

    expect(container.textContent).toContain(baseComment.content);
    Object.values(Strings.retroBoard.categories).forEach((label) => {
      expect(container.textContent).not.toContain(label);
    });
  });
});
