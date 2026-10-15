import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(90000);

// Feature 20 (product-backlog/20-issue-tracking.md). The approver is an allowlisted real address —
// safe only because this suite runs against the isolated test database.
describe('Focus points (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const mk = (n: string) => ({ username: `test_e2e_fp_${n}`, email: `test_e2e_fp_${n}@example.com`, password: 'password123' });
  const users = { lead: mk('lead'), m1: mk('m1'), m2: mk('m2'), m3: mk('m3'), outsider: mk('out') };
  const approver = { username: 'test_e2e_fp_approver', email: 'lironka13@gmail.com', password: 'password123' };

  const tok: Record<string, string> = {};
  const id: Record<string, number> = {};
  let teamId: number; let pastSprint: number; let futureSprint: number;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = () => request(app.getHttpServer());

  async function register(key: string, u: { username: string; email: string; password: string }) {
    const res = await api().post('/auth/register').send(u).expect(201);
    tracker.trackUser(res.body.user.id);
    tok[key] = res.body.accessToken;
    id[key] = res.body.user.id;
  }

  async function join(key: string) {
    const invite = await api().post(`/teams/${teamId}/invites`).set(auth(tok.lead)).send({}).expect(201);
    await api().post(`/invites/${invite.body.token}/consume`).set(auth(tok[key])).expect(201);
  }

  const sprint = async (name: string, startDate: string, endDate: string) =>
    (await api().post(`/teams/${teamId}/sprints`).set(auth(tok.lead)).send({ name, startDate, endDate }).expect(201)).body.id as number;

  const comment = async (sprintId: number, key: string, content: string) =>
    (await api().post(`/sprints/${sprintId}/comments`).set(auth(tok[key])).send({ content, type: 'IMPROVE' }).expect(201)).body.id as number;

  const createPoint = async (body: object) =>
    (await api().post(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).send(body).expect(201)).body;

  const rate = (pointId: number, key: string, sprintId: number, score: number, reason?: string) =>
    api().put(`/focus-points/${pointId}/rating`).set(auth(tok[key])).send({ sprintId, score, reason });

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany({ where: { OR: [{ username: { startsWith: 'test_e2e_fp_' } }, { email: approver.email }] } });
    await app.init();

    for (const [k, u] of Object.entries(users)) await register(k, u);
    await register('approver', approver);

    const res = await api().post('/teams').set(auth(tok.lead)).send({ name: 'fp-team', approverEmail: approver.email }).expect(201);
    teamId = res.body.id;
    tracker.trackTeam(teamId);
    await api().post(`/teams/${teamId}/approve`).set(auth(tok.approver)).expect(201);
    for (const k of ['m1', 'm2', 'm3']) await join(k);

    pastSprint = await sprint('ספרינט עבר', '2026-01-01', '2026-01-14');
    futureSprint = await sprint('ספרינט עתידי', '2098-01-01', '2099-01-01');
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  it('requires auth, and management endpoints are for admin/team leader only', async () => {
    await api().get(`/teams/${teamId}/focus-points`).expect(401);
    await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.m1)).expect(403);
    await api().post(`/teams/${teamId}/focus-points`).set(auth(tok.m1)).send({ kind: 'KEEP', text: 'x' }).expect(403);
    await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.outsider)).expect(403);
  });

  describe('proposals (#6)', () => {
    let commentId: number;
    it('lets members propose once each; the managers see only a count', async () => {
      commentId = await comment(pastSprint, 'm1', 'הבדיקות איטיות');
      await api().post(`/comments/${commentId}/propose`).set(auth(tok.m1)).expect(201);
      await api().post(`/comments/${commentId}/propose`).set(auth(tok.m1)).expect(409);
      await api().post(`/comments/${commentId}/propose`).set(auth(tok.m2)).expect(201);
      await api().post(`/comments/${commentId}/propose`).set(auth(tok.outsider)).expect(404);

      const mine = await api().get(`/sprints/${pastSprint}/proposed-comments`).set(auth(tok.m1)).expect(200);
      expect(mine.body).toEqual([commentId]);

      const list = await api().get(`/teams/${teamId}/focus-point-proposals`).set(auth(tok.lead)).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ commentId, proposerCount: 2 });
      expect(JSON.stringify(list.body)).not.toMatch(/userId|username|m1|m2/);
    });

    it('creating a point from the comment answers the proposals', async () => {
      await createPoint({ kind: 'IMPROVE', text: 'לזרז את הבדיקות', initialScore: 2, sourceCommentIds: [commentId] });
      const list = await api().get(`/teams/${teamId}/focus-point-proposals`).set(auth(tok.lead)).expect(200);
      expect(list.body).toEqual([]);
    });
  });

  describe('pool, merge and settings', () => {
    it('validates a new point', async () => {
      const bad = (b: object) => api().post(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).send(b).expect(400);
      await bad({ kind: 'IMPROVE', text: 'x' });
      await bad({ kind: 'IMPROVE', text: 'x', initialScore: 6 });
      await bad({ kind: 'IMPROVE', text: '  ', initialScore: 3 });
      await bad({ kind: 'WHAT', text: 'x' });
      await bad({ kind: 'KEEP', text: 'x', sourceCommentIds: [999999] });
    });

    it('merges two points: comments move, the source is hidden, history of the text is kept', async () => {
      const c1 = await comment(pastSprint, 'm2', 'CI איטי');
      const a = await createPoint({ kind: 'IMPROVE', text: 'CI איטי', initialScore: 2, sourceCommentIds: [c1] });
      const b = await createPoint({ kind: 'IMPROVE', text: 'הבדיקות לא יציבות', initialScore: 3 });
      await api().post(`/focus-points/${b.id}/merge`).set(auth(tok.m1)).send({ intoId: a.id }).expect(403);
      await api().post(`/focus-points/${b.id}/merge`).set(auth(tok.lead)).send({ intoId: b.id }).expect(400);
      await api().post(`/focus-points/${b.id}/merge`).set(auth(tok.lead)).send({ intoId: a.id, text: 'CI איטי ובדיקות לא יציבות' }).expect(201);

      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      expect(list.body.points.map((p: any) => p.id)).not.toContain(b.id);
      const merged = list.body.points.find((p: any) => p.id === a.id);
      expect(merged.text).toBe('CI איטי ובדיקות לא יציבות');
      expect(merged.mergedFromCount).toBe(1);

      const history = await api().get(`/focus-points/${a.id}/history`).set(auth(tok.lead)).expect(200);
      expect(history.body.map((v: any) => v.text)).toEqual(['CI איטי', 'CI איטי ובדיקות לא יציבות']);
      await api().post(`/focus-points/${b.id}/merge`).set(auth(tok.lead)).send({ intoId: a.id }).expect(409);
    });

    it('a KEEP point is a counter only: no lifecycle, not selectable', async () => {
      const keep = await createPoint({ kind: 'KEEP', text: 'ה-demo השבועי עובד מצוין' });
      expect(keep.initialScore).toBeNull();
      await api().patch(`/focus-points/${keep.id}`).set(auth(tok.lead)).send({ status: 'ARCHIVED' }).expect(400);
      await api().put(`/sprints/${pastSprint}/focus-points/${keep.id}/select`).set(auth(tok.lead)).expect(400);
    });

    it('updates the quota within 1-10', async () => {
      await api().patch(`/teams/${teamId}/focus-point-settings`).set(auth(tok.lead)).send({ quota: 11 }).expect(400);
      await api().patch(`/teams/${teamId}/focus-point-settings`).set(auth(tok.m1)).send({ quota: 2 }).expect(403);
      const res = await api().patch(`/teams/${teamId}/focus-point-settings`).set(auth(tok.lead)).send({ quota: 3 }).expect(200);
      expect(res.body.quota).toBe(3);
    });
  });

  describe('the sprint loop: select -> rate -> close -> score', () => {
    let point: number; let extras: number[];

    it('enforces the per-sprint quota', async () => {
      point = (await createPoint({ kind: 'IMPROVE', text: 'נקודת הלולאה', initialScore: 3 })).id;
      extras = [];
      for (let i = 0; i < 3; i++) extras.push((await createPoint({ kind: 'IMPROVE', text: `עוד ${i}`, initialScore: 3 })).id);
      await api().put(`/sprints/${pastSprint}/focus-points/${point}/select`).set(auth(tok.m1)).expect(403);
      await api().put(`/sprints/${pastSprint}/focus-points/${point}/select`).set(auth(tok.lead)).expect(200);
      await api().put(`/sprints/${pastSprint}/focus-points/${extras[0]}/select`).set(auth(tok.lead)).expect(200);
      await api().put(`/sprints/${pastSprint}/focus-points/${extras[1]}/select`).set(auth(tok.lead)).expect(200);
      await api().put(`/sprints/${pastSprint}/focus-points/${extras[2]}/select`).set(auth(tok.lead)).expect(409);
      // idempotent for one already selected
      await api().put(`/sprints/${pastSprint}/focus-points/${point}/select`).set(auth(tok.lead)).expect(200);
    });

    it('a member sees the selected points but no score; the window is open for a finished sprint', async () => {
      const view = await api().get(`/sprints/${pastSprint}/focus-points`).set(auth(tok.m1)).expect(200);
      expect(view.body.window).toBe('OPEN');
      expect(view.body.points.map((p: any) => p.id)).toContain(point);
      expect(JSON.stringify(view.body)).not.toMatch(/average|trend|currentScore|initialScore/);
      await api().get(`/sprints/${pastSprint}/focus-points`).set(auth(tok.outsider)).expect(404);
    });

    it('rating validation, and no rating before the window opens', async () => {
      await rate(point, 'm1', pastSprint, 0).expect(400);
      await rate(point, 'm1', pastSprint, 6).expect(400);
      await rate(point, 'm1', pastSprint, 3.5).expect(400);
      await rate(point, 'outsider', pastSprint, 3).expect(404);
      await api().put(`/sprints/${futureSprint}/focus-points/${point}/select`).set(auth(tok.lead)).expect(200);
      await rate(point, 'm1', futureSprint, 3).expect(400);
      await api().post(`/sprints/${futureSprint}/rating-close`).set(auth(tok.lead)).expect(400);
      await api().delete(`/sprints/${futureSprint}/focus-points/${point}/select`).set(auth(tok.lead)).expect(200);
    });

    it('two ratings are not enough: the sprint is not counted and the point stays', async () => {
      const lines: string[] = [];
      const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((msg: unknown) => { lines.push(String(msg)); });
      await rate(point, 'm1', pastSprint, 5, 'סיבה-סודית-א').expect(200);
      await rate(point, 'm2', pastSprint, 5).expect(200);
      spy.mockRestore();
      // Process logging exists for the rating, but never links a person (or a score) to it.
      const ratedLines = lines.filter((l) => l.startsWith('focus_point.rated'));
      expect(ratedLines).toHaveLength(2);
      expect(ratedLines[0]).toContain(`sprintId=${pastSprint}`);
      for (const l of ratedLines) expect(l).not.toMatch(new RegExp(`userId|username|score|m1|m2|=${id.m1}\\b|=${id.m2}\\b|סיבה`));
      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      const p = list.body.points.find((x: any) => x.id === point);
      // results appear only after the window is closed — and never for fewer than 3 raters
      expect(p.history[0]).toMatchObject({ closed: false, average: null });
    });

    it('3 ratings close the point at an average >= 4.5; a re-rate replaces, not adds; identity is never returned', async () => {
      await rate(point, 'm1', pastSprint, 4).expect(200);
      await rate(point, 'm1', pastSprint, 5).expect(200);
      await rate(point, 'm3', pastSprint, 4, 'סיבה-סודית-ב').expect(200);
      await rate(point, 'lead', pastSprint, 5).expect(200);

      await api().post(`/sprints/${pastSprint}/rating-close`).set(auth(tok.m1)).expect(403);
      const closed = await api().post(`/sprints/${pastSprint}/rating-close`).set(auth(tok.lead)).expect(201);
      expect(closed.body.outcomes).toEqual(expect.arrayContaining([{ focusPointId: point, outcome: 'CLOSED' }]));
      await api().post(`/sprints/${pastSprint}/rating-close`).set(auth(tok.lead)).expect(409);
      await rate(point, 'm2', pastSprint, 1).expect(409);

      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      const p = list.body.points.find((x: any) => x.id === point);
      expect(p.status).toBe('CLOSED');
      expect(p.history[0]).toMatchObject({ closed: true, valid: true, raterCount: 4 });
      expect(p.history[0].average).toBeCloseTo(4.75, 5);
      expect(p.history[0].trend).toBe('IMPROVED');
      expect(p.currentScore).toBeCloseTo(4.75, 5);
      // nothing in the whole payload identifies a rater or exposes the "why"
      expect(JSON.stringify(list.body)).not.toMatch(/"userId"|סיבה-סודית/);
      const m1View = await api().get(`/sprints/${pastSprint}/focus-points`).set(auth(tok.m1)).expect(200);
      expect(m1View.body.window).toBe('CLOSED');
    });

    it('leaving the team erases the rater identity in the database but keeps the scores', async () => {
      const before = await prisma.focusPointRating.count({ where: { focusPointId: point, userId: id.m3 } });
      expect(before).toBe(1);
      await api().post(`/teams/${teamId}/leave`).set(auth(tok.m3)).expect(201);
      expect(await prisma.focusPointRating.count({ where: { focusPointId: point, userId: id.m3 } })).toBe(0);
      expect(await prisma.focusPointRating.count({ where: { focusPointId: point } })).toBe(4);
      // the "why" is still stored (nobody can read it through the API)
      expect(await prisma.focusPointRating.count({ where: { focusPointId: point, reason: 'סיבה-סודית-ב' } })).toBe(1);
    });
  });

  describe('watch countdown and a team that is too small', () => {
    it('"watch for N more sprints" archives the point with its final score when it never reaches 4.5', async () => {
      const sp = await sprint('ספרינט מעקב', '2026-02-01', '2026-02-14');
      const p = await createPoint({ kind: 'IMPROVE', text: 'מעקב קצר', initialScore: 2 });
      await api().patch(`/focus-points/${p.id}`).set(auth(tok.lead)).send({ watchSprintsLeft: 1 }).expect(200);
      await api().put(`/sprints/${sp}/focus-points/${p.id}/select`).set(auth(tok.lead)).expect(200);
      await rate(p.id, 'm1', sp, 3).expect(200);
      await rate(p.id, 'm2', sp, 3).expect(200);
      await rate(p.id, 'lead', sp, 3).expect(200);
      await api().post(`/sprints/${sp}/rating-close`).set(auth(tok.lead)).expect(201);
      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      const got = list.body.points.find((x: any) => x.id === p.id);
      expect(got.status).toBe('ARCHIVED');
      expect(got.currentScore).toBeCloseTo(3, 5);
      await api().patch(`/focus-points/${p.id}`).set(auth(tok.lead)).send({ status: 'ACTIVE' }).expect(200);
    });

    it('a sprint with fewer than 3 valid ratings is not counted and the point carries on', async () => {
      const sp = await sprint('ספרינט ריק', '2026-03-01', '2026-03-14');
      const p = await createPoint({ kind: 'IMPROVE', text: 'ממשיכה', initialScore: 2 });
      await api().put(`/sprints/${sp}/focus-points/${p.id}/select`).set(auth(tok.lead)).expect(200);
      await rate(p.id, 'm1', sp, 5).expect(200);
      const closed = await api().post(`/sprints/${sp}/rating-close`).set(auth(tok.lead)).expect(201);
      expect(closed.body.outcomes).toEqual([{ focusPointId: p.id, outcome: 'NOT_COUNTED' }]);
      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      const got = list.body.points.find((x: any) => x.id === p.id);
      expect(got.status).toBe('ACTIVE');
      expect(got.history[0]).toMatchObject({ closed: true, valid: false, average: null });
      expect(got.currentScore).toBe(2);
    });

    it('with only 2 active members the tracking works but no score is ever shown', async () => {
      // lead + m1 + m2 remain after m3 left; remove m2 to leave exactly two
      await prisma.teamMember.deleteMany({ where: { teamId, userId: id.m2 } });
      const sp = await sprint('ספרינט קטן', '2026-04-01', '2026-04-14');
      const p = await createPoint({ kind: 'IMPROVE', text: 'צוות קטן', initialScore: 2 });
      await api().put(`/sprints/${sp}/focus-points/${p.id}/select`).set(auth(tok.lead)).expect(200);
      await rate(p.id, 'm1', sp, 5).expect(200);
      await rate(p.id, 'lead', sp, 5).expect(200);
      await api().post(`/sprints/${sp}/rating-close`).set(auth(tok.lead)).expect(201);
      const list = await api().get(`/teams/${teamId}/focus-points`).set(auth(tok.lead)).expect(200);
      expect(list.body.resultsHidden).toBe(true);
      expect(list.body.points.find((x: any) => x.id === p.id).history[0]).toMatchObject({ valid: false, average: null });
    });
  });

  describe('tasks under a point (#3)', () => {
    let pointId: number; let taskId: number;
    it('management creates and assigns; the assignee moves their own task; others cannot', async () => {
      pointId = (await createPoint({ kind: 'IMPROVE', text: 'עם משימות', initialScore: 2 })).id;
      await api().post(`/focus-points/${pointId}/tasks`).set(auth(tok.m1)).send({ title: 'x' }).expect(403);
      await api().post(`/focus-points/${pointId}/tasks`).set(auth(tok.lead)).send({ title: '   ' }).expect(400);
      await api().post(`/focus-points/${pointId}/tasks`).set(auth(tok.lead)).send({ title: 'x', assigneeId: id.outsider }).expect(400);
      const created = await api().post(`/focus-points/${pointId}/tasks`).set(auth(tok.lead))
        .send({ title: 'להוסיף בדיקות', assigneeId: id.m1, dueDate: '2026-12-01' }).expect(201);
      taskId = created.body.id;

      const mine = await api().get('/me/focus-point-tasks').set(auth(tok.m1)).expect(200);
      expect(mine.body.map((t: any) => t.id)).toContain(taskId);
      expect((await api().get('/me/focus-point-tasks').set(auth(tok.lead)).expect(200)).body.map((t: any) => t.id)).not.toContain(taskId);

      await api().patch(`/focus-point-tasks/${taskId}`).set(auth(tok.m1)).send({ title: 'שיניתי' }).expect(403);
      const done = await api().patch(`/focus-point-tasks/${taskId}`).set(auth(tok.m1)).send({ status: 'DONE' }).expect(200);
      expect(done.body.closedAt).toEqual(expect.any(String));
      await api().patch(`/focus-point-tasks/${taskId}`).set(auth(tok.outsider)).send({ status: 'DONE' }).expect(404);
      await api().delete(`/focus-point-tasks/${taskId}`).set(auth(tok.m1)).expect(403);
      await api().delete(`/focus-point-tasks/${taskId}`).set(auth(tok.lead)).expect(200);
    });
  });
});
