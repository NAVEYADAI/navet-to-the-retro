import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(90000);

// Feature 21 (product-backlog/21-onboarding-and-feature-discovery.md §21.3, specs/21-onboarding.md).
// The approver is an allowlisted real address — safe only because this suite runs against the
// isolated test database.
describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const mk = (n: string) => ({ username: `test_e2e_ob_${n}`, email: `test_e2e_ob_${n}@example.com`, password: 'password123' });
  const users = { fresh: mk('fresh'), lead: mk('lead'), member: mk('member'), mixed: mk('mixed'), pending: mk('pending'), gone: mk('gone') };
  const approver = { username: 'test_e2e_ob_approver', email: 'lironka13@gmail.com', password: 'password123' };

  const tok: Record<string, string> = {};
  const id: Record<string, number> = {};

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = () => request(app.getHttpServer());
  const status = async (key: string) => (await api().get('/onboarding/status').set(auth(tok[key])).expect(200)).body;
  const stepMap = (body: any) => Object.fromEntries(body.steps.map((s: any) => [s.key, s.done]));

  async function register(key: string, u: { username: string; email: string; password: string }) {
    const res = await api().post('/auth/register').send(u).expect(201);
    tracker.trackUser(res.body.user.id);
    tok[key] = res.body.accessToken;
    id[key] = res.body.user.id;
  }

  /** Creates and approves a team led by `leaderKey`; the shared approver account approves it. */
  async function approvedTeam(leaderKey: string, name: string) {
    const res = await api().post('/teams').set(auth(tok[leaderKey])).send({ name, approverEmail: approver.email }).expect(201);
    tracker.trackTeam(res.body.id);
    await api().post(`/teams/${res.body.id}/approve`).set(auth(tok.approver)).expect(201);
    return res.body.id as number;
  }

  async function joinViaInvite(teamId: number, leaderKey: string, memberKey: string) {
    const invite = await api().post(`/teams/${teamId}/invites`).set(auth(tok[leaderKey])).send({}).expect(201);
    await api().post(`/invites/${invite.body.token}/consume`).set(auth(tok[memberKey])).expect(201);
  }

  const sprint = async (teamId: number, leaderKey: string, name: string, startDate: string, endDate: string) =>
    (await api().post(`/teams/${teamId}/sprints`).set(auth(tok[leaderKey])).send({ name, startDate, endDate }).expect(201)).body.id as number;

  let teamA: number; // led by `lead`, `member` is a plain member
  let teamB: number; // led by `mixed`... no: `lead` leads A; `mixed` leads teamM and is a plain member of teamA
  let teamM: number;
  let pastSprint: number;

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany({ where: { OR: [{ username: { startsWith: 'test_e2e_ob_' } }, { email: approver.email }] } });
    await app.init();

    for (const [k, u] of Object.entries(users)) await register(k, u);
    await register('approver', approver);
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  it('every endpoint requires a valid token', async () => {
    await api().get('/onboarding/status').expect(401);
    await api().post('/onboarding/dismiss-checklist').expect(401);
    await api().post('/onboarding/restore-checklist').expect(401);
    await api().post('/onboarding/seen-features').send({ keys: [] }).expect(401);
    await api().get('/onboarding/status').set(auth('garbage')).expect(401);
  });

  describe('track derivation', () => {
    it('a brand-new user (no team at all) is on the management track with nothing done, and reading creates no state row', async () => {
      const body = await status('fresh');
      expect(body.track).toBe('MANAGEMENT');
      expect(body.steps.map((s: any) => s.key)).toEqual(['create-team', 'invite-member', 'open-sprint', 'close-sprint', 'pick-focus-point']);
      expect(body.steps.every((s: any) => s.done === false && s.optional === false)).toBe(true);
      expect(body.checklistComplete).toBe(false);
      expect(body.checklistDismissed).toBe(false);
      expect(body.unseenFeatureKeys).toEqual([]); // management-only features are not announced to someone who manages nothing
      expect(await prisma.userOnboardingState.count({ where: { userId: id.fresh } })).toBe(0);
    });

    it('a team still awaiting approval is not progress', async () => {
      await api().post('/teams').set(auth(tok.pending)).send({ name: 'ob-pending', approverEmail: approver.email }).expect(201)
        .then((r) => tracker.trackTeam(r.body.id));
      const body = await status('pending');
      expect(body.track).toBe('MANAGEMENT');
      expect(stepMap(body)['create-team']).toBe(false);
      expect(body.unseenFeatureKeys).toEqual([]);
    });

    it('the team leader of an approved team: management track, create-team done, focus-points announced', async () => {
      teamA = await approvedTeam('lead', 'ob-team-a');
      const body = await status('lead');
      expect(body.track).toBe('MANAGEMENT');
      expect(stepMap(body)).toEqual({ 'create-team': true, 'invite-member': false, 'open-sprint': false, 'close-sprint': false, 'pick-focus-point': false });
      expect(body.unseenFeatureKeys).toEqual(['focus-points']);
    });

    it('management steps follow real data: invite, open sprint, ended sprint, focus point', async () => {
      await api().post(`/teams/${teamA}/invites`).set(auth(tok.lead)).send({}).expect(201);
      expect(stepMap(await status('lead'))['invite-member']).toBe(true);

      await sprint(teamA, 'lead', 'ob-future', '2098-01-01', '2099-01-01');
      let m = stepMap(await status('lead'));
      expect(m['open-sprint']).toBe(true);
      expect(m['close-sprint']).toBe(false);

      pastSprint = await sprint(teamA, 'lead', 'ob-past', '2026-01-01', '2026-01-14');
      m = stepMap(await status('lead'));
      expect(m['close-sprint']).toBe(true);
      expect(m['pick-focus-point']).toBe(false);

      await api().post(`/teams/${teamA}/focus-points`).set(auth(tok.lead)).send({ kind: 'IMPROVE', text: 'ob point', initialScore: 3 }).expect(201);
      const body = await status('lead');
      expect(Object.values(stepMap(body)).every(Boolean)).toBe(true);
      expect(body.checklistComplete).toBe(true);
    });

    it('a member invited to the team is on the member track: joined, comment pending, Telegram optional', async () => {
      await joinViaInvite(teamA, 'lead', 'member');
      const body = await status('member');
      expect(body.track).toBe('MEMBER');
      expect(body.steps).toEqual([
        { key: 'join-team', done: true, optional: false },
        { key: 'first-comment', done: false, optional: false },
        { key: 'connect-telegram', done: false, optional: true },
      ]);
      expect(body.checklistComplete).toBe(false);
      expect(body.unseenFeatureKeys).toEqual([]); // the improvement-points announcement is management-only
    });

    it('a comment completes the required member steps; Telegram is optional and a revoked link does not count', async () => {
      await api().post(`/sprints/${pastSprint}/comments`).set(auth(tok.member)).send({ content: 'ob comment', type: 'KEEP' }).expect(201);
      let body = await status('member');
      expect(stepMap(body)['first-comment']).toBe(true);
      expect(body.checklistComplete).toBe(true); // connect-telegram is still false

      const link = await prisma.userMessagingLink.create({ data: { userId: id.member, channel: 'TELEGRAM', externalId: 'ob-e2e-tg', isRevoked: true } });
      expect(stepMap(await status('member'))['connect-telegram']).toBe(false);
      await prisma.userMessagingLink.update({ where: { id: link.id }, data: { isRevoked: false } });
      body = await status('member');
      expect(stepMap(body)['connect-telegram']).toBe(true);
      expect(body.checklistComplete).toBe(true);
    });

    it('mixed user (plain member of one team, leader of another) gets the management track and the management announcement', async () => {
      await joinViaInvite(teamA, 'lead', 'mixed'); // plain member of A
      expect((await status('mixed')).track).toBe('MEMBER');
      expect((await status('mixed')).unseenFeatureKeys).toEqual([]);

      teamM = await approvedTeam('mixed', 'ob-team-mixed');
      const body = await status('mixed');
      expect(body.track).toBe('MANAGEMENT');
      expect(body.unseenFeatureKeys).toEqual(['focus-points']);
      // management steps are about the team they manage (teamM: empty), not teamA which is full of data
      expect(stepMap(body)).toEqual({ 'create-team': true, 'invite-member': false, 'open-sprint': false, 'close-sprint': false, 'pick-focus-point': false });
    });

    it('a soft-deleted team is not progress: the leader falls back to a new-user state', async () => {
      const teamG = await approvedTeam('gone', 'ob-team-gone');
      expect(stepMap(await status('gone'))['create-team']).toBe(true);
      await api().delete(`/teams/${teamG}`).set(auth(tok.gone)).send({ confirmName: 'ob-team-gone' }).expect(200);
      const body = await status('gone');
      expect(body.track).toBe('MANAGEMENT');
      expect(body.steps.every((s: any) => s.done === false)).toBe(true);
      expect(body.unseenFeatureKeys).toEqual([]);
    });
  });

  describe('interactive guide hints and auto-start (feature 22)', () => {
    const login = async (key: string) =>
      (await api().post('/auth/login').send({ username: users[key as keyof typeof users].username, password: 'password123' }).expect(200)).body.accessToken as string;

    it('hints.endedSprintId is the latest finished sprint and never a deleted one', async () => {
      expect((await status('lead')).hints.endedSprintId).toBe(pastSprint);
      // a later-ending finished sprint wins ...
      const later = await sprint(teamA, 'lead', 'ob-past-later', '2026-02-01', '2026-02-14');
      expect((await status('lead')).hints.endedSprintId).toBe(later);
      // ... until it is soft-deleted: then the previous one is shown again
      await prisma.sprint.update({ where: { id: later }, data: { deletedAt: new Date() } });
      expect((await status('lead')).hints.endedSprintId).toBe(pastSprint);
      await prisma.sprint.delete({ where: { id: later } });
    });

    it('a user with no team has no endedSprintId', async () => {
      expect((await status('fresh')).hints).toEqual({ teamId: null, activeSprintId: null, endedSprintId: null });
    });

    it('a brand-new user gets guideAutoStart once; guide-started is idempotent and sticks across logins', async () => {
      expect((await status('fresh')).guideAutoStart).toBe(true);
      await api().post('/onboarding/guide-started').set(auth(tok.fresh)).expect(201);
      expect((await status('fresh')).guideAutoStart).toBe(false);
      const first = await prisma.userOnboardingState.findUnique({ where: { userId: id.fresh } });
      expect(first?.guideAutoStartedAt).toBeTruthy();

      await api().post('/onboarding/guide-started').set(auth(tok.fresh)).expect(201);
      const second = await prisma.userOnboardingState.findUnique({ where: { userId: id.fresh } });
      expect(second?.guideAutoStartedAt).toEqual(first?.guideAutoStartedAt);

      tok.fresh = await login('fresh');
      expect((await status('fresh')).guideAutoStart).toBe(false);
    });

    it('an existing user (team with sprints / a written comment) is never auto-started', async () => {
      expect((await status('lead')).guideAutoStart).toBe(false);
      expect((await status('member')).guideAutoStart).toBe(false);
    });

    it('guide-started requires a valid token', async () => {
      await api().post('/onboarding/guide-started').expect(401);
    });
  });

  describe('seen-features and dismiss persist across sessions', () => {
    const login = async (key: string) => {
      const res = await api().post('/auth/login').send({ username: users[key as keyof typeof users].username, password: 'password123' }).expect(200); // a fresh login = a new session; state must come from the DB, not the token
      return res.body.accessToken as string;
    };

    it('marking a feature seen is stored, idempotent, ignores unknown keys, and survives a new login', async () => {
      const first = await api().post('/onboarding/seen-features').set(auth(tok.lead)).send({ keys: ['focus-points', 'no-such-feature'] }).expect(201);
      expect(first.body.seenFeatureKeys).toEqual(['focus-points']);
      const again = await api().post('/onboarding/seen-features').set(auth(tok.lead)).send({ keys: ['focus-points', 'focus-points'] }).expect(201);
      expect(again.body.seenFeatureKeys).toEqual(['focus-points']);
      expect((await prisma.userOnboardingState.findUnique({ where: { userId: id.lead } }))!.seenFeatureKeys).toEqual(['focus-points']);

      tok.lead = await login('lead');
      expect((await status('lead')).unseenFeatureKeys).toEqual([]);
      // seen state belongs to the user: another manager still gets the announcement
      expect((await status('mixed')).unseenFeatureKeys).toEqual(['focus-points']);
    });

    it('rejects a malformed body with 400 and writes nothing', async () => {
      const before = await prisma.userOnboardingState.findUnique({ where: { userId: id.mixed } });
      for (const body of [{}, { keys: 'focus-points' }, { keys: [1, 2] }, { keys: Array.from({ length: 51 }, (_, i) => `k${i}`) }]) {
        const res = await api().post('/onboarding/seen-features').set(auth(tok.mixed)).send(body).expect(400);
        expect(res.body.message).toBe('רשימת מפתחות לא תקינה');
      }
      await api().post('/onboarding/seen-features').set(auth(tok.mixed)).expect(400);
      expect(await prisma.userOnboardingState.findUnique({ where: { userId: id.mixed } })).toEqual(before);
    });

    it('dismissing the checklist and restoring it are stored per user and survive a new login', async () => {
      expect((await api().post('/onboarding/dismiss-checklist').set(auth(tok.member)).expect(201)).body).toEqual({ checklistDismissed: true });
      tok.member = await login('member');
      expect((await status('member')).checklistDismissed).toBe(true);
      expect((await status('lead')).checklistDismissed).toBe(false);

      expect((await api().post('/onboarding/restore-checklist').set(auth(tok.member)).expect(201)).body).toEqual({ checklistDismissed: false });
      expect((await status('member')).checklistDismissed).toBe(false);
    });

    it('deleting the user cascades to the onboarding state', async () => {
      await api().post('/onboarding/dismiss-checklist').set(auth(tok.fresh)).expect(201);
      expect(await prisma.userOnboardingState.count({ where: { userId: id.fresh } })).toBe(1);
      await prisma.user.delete({ where: { id: id.fresh } });
      expect(await prisma.userOnboardingState.count({ where: { userId: id.fresh } })).toBe(0);
    });
  });
});
