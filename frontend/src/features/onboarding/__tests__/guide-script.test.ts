import fs from 'node:fs';
import path from 'node:path';
import { Strings } from '@/constants/strings';
import { ADVANCED_STEPS, BASIC_STEPS, buildGuideContext, filterSteps } from '../guide/guide-script';
import { pressTargetOf } from '../guide/guide-machine';
import type { GuideContext, GuidePlatform } from '../guide/guide-types';
import type { OnboardingStatus } from '../types';

jest.mock('@/lib/sprint-routes', () => ({
  sprintPath: (t: number, s: number, v = 'board') => `/team/${t}/sprint/${s}${v === 'board' ? '' : `/${v}`}`,
}));

const status = (over: Partial<OnboardingStatus> = {}, hints: Partial<NonNullable<OnboardingStatus['hints']>> = {}): OnboardingStatus => ({
  track: 'MANAGEMENT', steps: [], checklistComplete: false, checklistDismissed: false, unseenFeatureKeys: [],
  hints: { teamId: 7, activeSprintId: 40, endedSprintId: 31, ...hints }, ...over,
});
const ids = (ctx: GuideContext, steps = BASIC_STEPS) => filterSteps(steps, ctx).map((s) => s.id);
const ctxOf = (st: OnboardingStatus | null, platform: GuidePlatform = 'web') => buildGuideContext(st, platform);

describe('buildGuideContext', () => {
  it('derives the flags from the status hints', () => {
    expect(ctxOf(status())).toMatchObject({ isManagement: true, hasTeam: true, canManage: true, hasActiveSprint: true, hasEndedSprint: true, teamId: 7 });
    expect(ctxOf(status({ track: 'MEMBER' }))).toMatchObject({ isManagement: false, canManage: false, hasTeam: true });
    expect(ctxOf(status({}, { teamId: null, activeSprintId: null, endedSprintId: null }))).toMatchObject({ hasTeam: false, canManage: false, hasActiveSprint: false });
  });

  it('treats an unavailable status like a brand-new management user (data-free steps + demo only)', () => {
    expect(ctxOf(null)).toMatchObject({ isManagement: true, hasTeam: false, hasActiveSprint: false, hasEndedSprint: false });
  });

  it('a sprint hint without a team never counts', () => {
    expect(ctxOf(status({}, { teamId: null, activeSprintId: 5 })).hasActiveSprint).toBe(false);
  });
});

describe('basic guide — which steps each user gets', () => {
  it('a brand-new user: create a team, then the demo board, never the real board or management-only steps', () => {
    expect(ids(ctxOf(null))).toEqual(['welcome', 'new-team', 'create-team-form', 'board-demo-write', 'board-demo-comments', 'summary-info', 'done']);
  });

  it('a manager with a team, an active and a finished sprint: the whole real flow, on web', () => {
    expect(ids(ctxOf(status()))).toEqual([
      'welcome', 'members-toggle', 'add-member', 'add-member-modal', 'add-member-close', 'sprint-new',
      'board-write', 'board-comments', 'summary', 'focus-points', 'done',
    ]);
  });

  it('on native the add-member dialog is explained instead of opened, and creating a team is on the dashboard', () => {
    expect(ids(ctxOf(status(), 'native'))).toEqual([
      'welcome', 'members-toggle', 'add-member-native', 'sprint-new', 'board-write', 'board-comments', 'summary', 'focus-points', 'done',
    ]);
    expect(ids(ctxOf(null, 'native'))).not.toContain('new-team');
    const create = BASIC_STEPS.find((s) => s.id === 'create-team-form')!;
    expect(create.route!(ctxOf(null, 'web'))).toBe('/settings');
    expect(create.route!(ctxOf(null, 'native'))).toBe('/');
  });

  it('a plain member never gets management steps', () => {
    expect(ids(ctxOf(status({ track: 'MEMBER' })))).toEqual(['welcome', 'members-toggle', 'board-write', 'board-comments', 'summary', 'done']);
  });

  it('a team without an active sprint falls back to the demo board; without a finished one, to the info note', () => {
    expect(ids(ctxOf(status({}, { activeSprintId: null, endedSprintId: null })))).toEqual([
      'welcome', 'members-toggle', 'add-member', 'add-member-modal', 'add-member-close', 'sprint-new',
      'board-demo-write', 'board-demo-comments', 'summary-info', 'focus-points', 'done',
    ]);
  });

  it('routes point at the user’s own team and sprints', () => {
    const ctx = ctxOf(status());
    const route = (id: string) => BASIC_STEPS.find((s) => s.id === id)!.route!(ctx);
    expect(route('board-write')).toBe('/team/7/sprint/40');
    expect(route('summary')).toBe('/team/7/sprint/31/summary');
    expect(route('focus-points')).toBe('/team/7/focus-points');
  });
});

describe('advanced guide', () => {
  it('points at the settings cards for everyone, and keeps team-admin notes for management only', () => {
    expect(ids(ctxOf(status({ track: 'MEMBER' })), ADVANCED_STEPS)).toEqual([
      'adv-welcome', 'settings-telegram', 'settings-google', 'settings-appearance', 'adv-categories', 'adv-done',
    ]);
    expect(ids(ctxOf(status()), ADVANCED_STEPS)).toContain('adv-logo');
    expect(ids(ctxOf(status()), ADVANCED_STEPS)).toContain('adv-phantom');
  });
});

describe('script integrity', () => {
  const all = [...BASIC_STEPS, ...ADVANCED_STEPS];
  const copy = Strings.onboarding.guide.steps as Record<string, { title: string; body: string }>;

  it('every step has its own title and body in Strings and ids are unique', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) {
      expect(copy[s.id]?.title).toBeTruthy();
      expect(copy[s.id]?.body).toBeTruthy();
    }
    for (const id of Object.keys(copy)) expect(all.map((s) => s.id)).toContain(id);
  });

  it('a pressable step has something to press', () => {
    for (const s of all.filter((x) => x.advanceOn.type === 'press')) expect(pressTargetOf(s)).toBeTruthy();
  });

  // The anchors the scripts point at must really exist in the screens — web AND native (except where a
  // step is platform-limited) — or the guide would silently fall back to a centred note.
  it('every anchor named in a script is rendered by a web screen and a native screen', () => {
    const root = path.resolve(__dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); }
        else if (/\.tsx$/.test(e.name)) files.push(full);
      }
    };
    walk(root);
    const isNative = (f: string) => /native/i.test(path.relative(root, f));
    const read = (list: string[]) => list.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const nativeSrc = read(files.filter(isNative));
    const webSrc = read(files.filter((f) => !isNative(f)));
    const has = (src: string, key: string) => new RegExp(`(name|guideAnchor|guideCloseAnchor)=["']${key}["']`).test(src);

    // the check below must be able to fail
    expect(has(nativeSrc, 'no-such-anchor')).toBe(false);
    expect(has(webSrc, 'board-compose')).toBe(true);
    expect(has(nativeSrc, 'board-compose')).toBe(true);

    for (const step of all.filter((s) => s.anchor)) {
      const key = step.anchor!;
      const platforms = step.platforms ?? ['web', 'native'];
      if (platforms.includes('web')) expect({ key, onWeb: has(webSrc, key) }).toEqual({ key, onWeb: true });
      // modal anchors are web-only by design (a native sheet is a system modal above the overlay)
      if (platforms.includes('native')) expect({ key, onNative: has(nativeSrc, key) }).toEqual({ key, onNative: true });
    }
  });
});
