import { checklistProgress, findManagedTeamId, getStepText, knownSteps, pickWhatsNew, shouldShowChecklist, stepCta } from '../onboarding-logic';
import { FEATURE_REGISTRY } from '../registry';
import type { OnboardingStatus } from '../types';

const status = (o: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
  track: 'MANAGEMENT',
  steps: [
    { key: 'create-team', done: true, optional: false },
    { key: 'invite-member', done: false, optional: false },
  ],
  checklistComplete: false,
  checklistDismissed: false,
  unseenFeatureKeys: [],
  ...o,
});

describe('shouldShowChecklist (feature 21 decisions #12/#13)', () => {
  it('shows while a required step is missing and it was not hidden', () => {
    expect(shouldShowChecklist(status())).toBe(true);
  });
  it('is hidden once dismissed, once complete, or before the status loaded', () => {
    expect(shouldShowChecklist(status({ checklistDismissed: true }))).toBe(false);
    expect(shouldShowChecklist(status({ checklistComplete: true }))).toBe(false);
    expect(shouldShowChecklist(null)).toBe(false);
  });
  it('is hidden when the server sent only steps this client has no wording for', () => {
    expect(shouldShowChecklist(status({ steps: [{ key: 'brand-new-step', done: false, optional: false }] }))).toBe(false);
  });
});

describe('checklistProgress', () => {
  it('counts required steps only — the optional recommended step never blocks or inflates progress', () => {
    const s = status({
      track: 'MEMBER',
      steps: [
        { key: 'join-team', done: true, optional: false },
        { key: 'first-comment', done: false, optional: false },
        { key: 'connect-telegram', done: true, optional: true },
      ],
    });
    expect(checklistProgress(s)).toEqual({ done: 1, total: 2 });
  });
});

describe('knownSteps / getStepText', () => {
  it('has wording for every key the backend can send', () => {
    for (const key of ['join-team', 'first-comment', 'connect-telegram', 'create-team', 'invite-member', 'open-sprint', 'close-sprint', 'pick-focus-point']) {
      expect(getStepText(key)).toBeDefined();
    }
  });
  it('drops unknown keys', () => {
    expect(knownSteps(status({ steps: [{ key: 'nope', done: false, optional: false }, { key: 'create-team', done: false, optional: false }] })).map((s) => s.key)).toEqual(['create-team']);
  });
});

describe('pickWhatsNew (decisions #5/#15)', () => {
  it('returns one card: the first unseen key in server order', () => {
    expect(pickWhatsNew(status({ unseenFeatureKeys: ['focus-points', 'team-logo'] }))?.key).toBe('focus-points');
  });
  it('skips keys missing from the registry and returns null when nothing is left', () => {
    expect(pickWhatsNew(status({ unseenFeatureKeys: ['unknown-key', 'telegram'] }))?.key).toBe('telegram');
    expect(pickWhatsNew(status({ unseenFeatureKeys: ['unknown-key'] }))).toBeNull();
    expect(pickWhatsNew(null)).toBeNull();
  });
});

describe('stepCta', () => {
  it('sends create-team and connect-telegram to settings, focus point to its screen only when a team is known', () => {
    expect(stepCta('create-team', false)).toBe('settings');
    expect(stepCta('connect-telegram', false)).toBe('settings');
    expect(stepCta('pick-focus-point', true)).toBe('focus-points');
    expect(stepCta('pick-focus-point', false)).toBe('none');
  });
  it('steps done inside the team cards have no button', () => {
    const hints = { teamId: 1, activeSprintId: 2 };
    for (const k of ['join-team', 'invite-member', 'open-sprint', 'close-sprint']) expect(stepCta(k, true, hints)).toBe('none');
    expect(stepCta('first-comment', true)).toBe('none');
  });
  it('first-comment opens the running sprint, only when one exists', () => {
    expect(stepCta('first-comment', false, { teamId: 1, activeSprintId: 2 })).toBe('sprint-board');
    expect(stepCta('first-comment', false, { teamId: 1, activeSprintId: null })).toBe('none');
    expect(stepCta('first-comment', false, { teamId: null, activeSprintId: 2 })).toBe('none');
  });
});

describe('findManagedTeamId', () => {
  const team = (id: number, me: object | null, extra: object = {}) => ({ id, members: me ? [{ userId: 7, ...me }] : [], ...extra });
  it('picks the first approved team where I am admin or team leader', () => {
    expect(findManagedTeamId([team(1, { role: 'DEVELOPER' }), team(2, { isAdmin: true }), team(3, { role: 'TEAM_LEADER' })], 7)).toBe(2);
    expect(findManagedTeamId([team(3, { role: 'TEAM_LEADER' })], 7)).toBe(3);
  });
  it('ignores pending teams, pending memberships and teams I am not in', () => {
    expect(findManagedTeamId([team(1, { isAdmin: true }, { status: 'PENDING_APPROVAL' }), team(2, { isAdmin: true, status: 'PENDING' }), team(3, null)], 7)).toBeNull();
  });
});

describe('registry', () => {
  it('lists the required features with audience, cta and since', () => {
    const keys = FEATURE_REGISTRY.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['focus-points', 'telegram', 'google-calendar', 'comment-categories', 'team-logo', 'phantom-members', 'pptx-export']));
    expect(FEATURE_REGISTRY.find((f) => f.key === 'focus-points')).toMatchObject({ audience: 'MANAGEMENT', cta: 'focus-points', since: '2026-10-15' });
    expect(FEATURE_REGISTRY.find((f) => f.key === 'phantom-members')?.audience).toBe('MANAGEMENT');
    for (const f of FEATURE_REGISTRY) {
      expect(f.title).toBeTruthy();
      expect(f.description).toBeTruthy();
      if (f.cta !== 'none') expect(f.ctaLabel).toBeTruthy();
    }
  });
});
