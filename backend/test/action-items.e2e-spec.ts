import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(60000);

// Feature 16 (product-backlog/16-action-items.md). The approver is an allowlisted real address —
// safe only because this suite runs against the isolated test database.
describe('Action items (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const admin = { username: 'test_e2e_ai_admin', email: 'test_e2e_ai_admin@example.com', password: 'password123' };
  const member = { username: 'test_e2e_ai_member', email: 'test_e2e_ai_member@example.com', password: 'password123' };
  const member2 = { username: 'test_e2e_ai_member2', email: 'test_e2e_ai_member2@example.com', password: 'password123' };
  const outsider = { username: 'test_e2e_ai_outsider', email: 'test_e2e_ai_outsider@example.com', password: 'password123' };
  const approver = { username: 'test_e2e_ai_approver', email: 'lironka13@gmail.com', password: 'password123' };

  let adminToken: string; let memberToken: string; let member2Token: string; let outsiderToken: string; let approverToken: string;
  let memberId: number; let member2Id: number; let outsiderId: number;
  let teamId: number; let sprint1: number; let sprint2: number;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = () => request(app.getHttpServer());

  async function registerAndLogin(user: { username: string; email: string; password: string }) {
    const res = await api().post('/auth/register').send(user).expect(201);
    tracker.trackUser(res.body.user.id);
    return { id: res.body.user.id as number, token: res.body.accessToken as string };
  }

  async function join(token: string) {
    const invite = await api().post(`/teams/${teamId}/invites`).set(auth(adminToken)).send({}).expect(201);
    await api().post(`/invites/${invite.body.token}/consume`).set(auth(token)).expect(201);
  }

  const createSprint = async (name: string, startDate: string, endDate: string) =>
    (await api().post(`/teams/${teamId}/sprints`).set(auth(adminToken)).send({ name, startDate, endDate }).expect(201)).body.id as number;

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({ where: { OR: [{ username: { startsWith: 'test_e2e_ai_' } }, { email: { in: [approver.email] } }] } });
    await app.init();

    adminToken = (await registerAndLogin(admin)).token;
    ({ id: memberId, token: memberToken } = await registerAndLogin(member));
    ({ id: member2Id, token: member2Token } = await registerAndLogin(member2));
    ({ id: outsiderId, token: outsiderToken } = await registerAndLogin(outsider));
    approverToken = (await registerAndLogin(approver)).token;

    const res = await api().post('/teams').set(auth(adminToken)).send({ name: 'ai-team', approverEmail: approver.email }).expect(201);
    teamId = res.body.id;
    tracker.trackTeam(teamId);
    await api().post(`/teams/${teamId}/approve`).set(auth(approverToken)).expect(201);
    await join(memberToken);
    await join(member2Token);

    sprint1 = await createSprint('ספרינט 1', '2026-01-01', '2026-01-14');
    sprint2 = await createSprint('ספרינט 2', '2026-01-15', '2026-01-28');
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  it('requires auth and team membership', async () => {
    await api().get(`/teams/${teamId}/action-items`).expect(401);
    await api().get(`/teams/${teamId}/action-items`).set(auth(outsiderToken)).expect(403);
    await api().post(`/sprints/${sprint1}/action-items`).set(auth(outsiderToken)).send({ title: 'x' }).expect(404);
  });

  describe('full flow: comment -> task -> next retro -> done', () => {
    let commentId: number; let itemId: number;

    it('creates a task from a comment with two assignees; a non-member assignee is a 400', async () => {
      commentId = (await api().post(`/sprints/${sprint1}/comments`).set(auth(memberToken))
        .send({ content: 'ה-CI איטי', type: 'IMPROVE', isAnonymous: true }).expect(201)).body.id;

      await api().post(`/sprints/${sprint1}/action-items`).set(auth(memberToken))
        .send({ title: 'לזרז את ה-CI', assigneeIds: [memberId, outsiderId] }).expect(400);

      const res = await api().post(`/sprints/${sprint1}/action-items`).set(auth(memberToken))
        .send({ title: 'לזרז את ה-CI', sourceCommentId: commentId, assigneeIds: [memberId, member2Id], dueDate: '2026-02-01' })
        .expect(201);
      itemId = res.body.id;
      expect(res.body.status).toBe('OPEN');
      expect(res.body.assignees.map((a: any) => a.userId).sort()).toEqual([memberId, member2Id].sort());
      expect(res.body.assignees.every((a: any) => a.isActiveMember)).toBe(true);
      // Anonymous source comment: nothing about its author leaks into the item.
      expect(JSON.stringify(res.body)).not.toContain('isAnonymous');
    });

    it('shows up for an assignee in /me/action-items, and not for a non-assignee', async () => {
      const mine = await api().get('/me/action-items').set(auth(member2Token)).expect(200);
      expect(mine.body.map((i: any) => i.id)).toContain(itemId);
      expect(mine.body[0].team).toEqual({ id: teamId, name: 'ai-team' });

      const adminsList = await api().get('/me/action-items').set(auth(adminToken)).expect(200);
      expect(adminsList.body.map((i: any) => i.id)).not.toContain(itemId);
    });

    it('is still open for the team (the "previous retro" strip of the next sprint) and ordered first', async () => {
      await api().post(`/sprints/${sprint2}/action-items`).set(auth(adminToken)).send({ title: 'משימה חדשה בלי תאריך' }).expect(201);
      const open = await api().get(`/teams/${teamId}/action-items?status=OPEN`).set(auth(adminToken)).expect(200);
      expect(open.body[0].id).toBe(itemId);
      const fromPrevious = open.body.filter((i: any) => i.sprintId !== sprint2);
      expect(fromPrevious.map((i: any) => i.id)).toEqual([itemId]);
    });

    it('survives the deletion of its source comment', async () => {
      await prisma.comment.delete({ where: { id: commentId } });
      const list = await api().get(`/teams/${teamId}/action-items`).set(auth(adminToken)).expect(200);
      const item = list.body.find((i: any) => i.id === itemId);
      expect(item).toBeDefined();
      expect(item.sourceCommentId).toBeNull();
    });

    it('marking it done sets closedAt and removes it from the open lists', async () => {
      const res = await api().patch(`/action-items/${itemId}`).set(auth(member2Token)).send({ status: 'DONE' }).expect(200);
      expect(res.body.status).toBe('DONE');
      expect(res.body.closedAt).toEqual(expect.any(String));

      const open = await api().get(`/teams/${teamId}/action-items?status=OPEN`).set(auth(adminToken)).expect(200);
      expect(open.body.map((i: any) => i.id)).not.toContain(itemId);
      const mine = await api().get('/me/action-items').set(auth(member2Token)).expect(200);
      expect(mine.body.map((i: any) => i.id)).not.toContain(itemId);

      const reopened = await api().patch(`/action-items/${itemId}`).set(auth(member2Token)).send({ status: 'OPEN' }).expect(200);
      expect(reopened.body.closedAt).toBeNull();
    });

    it('lets any member edit assignees and delete; outsiders get 404', async () => {
      await api().patch(`/action-items/${itemId}`).set(auth(outsiderToken)).send({ title: 'hack' }).expect(404);
      await api().delete(`/action-items/${itemId}`).set(auth(outsiderToken)).expect(404);

      const res = await api().patch(`/action-items/${itemId}`).set(auth(memberToken)).send({ assigneeIds: [] }).expect(200);
      expect(res.body.assignees).toEqual([]);

      await api().delete(`/action-items/${itemId}`).set(auth(memberToken)).expect(200);
      const list = await api().get(`/teams/${teamId}/action-items`).set(auth(adminToken)).expect(200);
      expect(list.body.map((i: any) => i.id)).not.toContain(itemId);
    });
  });

  it('keeps an assignee who later left the team, flagged as not active, and hides it from their dashboard', async () => {
    const created = await api().post(`/sprints/${sprint1}/action-items`).set(auth(adminToken))
      .send({ title: 'מי שעזב', assigneeIds: [member2Id] }).expect(201);
    await prisma.teamMember.deleteMany({ where: { teamId, userId: member2Id } });

    const list = await api().get(`/teams/${teamId}/action-items`).set(auth(adminToken)).expect(200);
    const item = list.body.find((i: any) => i.id === created.body.id);
    expect(item.assignees).toEqual([expect.objectContaining({ userId: member2Id, isActiveMember: false })]);

    const mine = await api().get('/me/action-items').set(auth(member2Token)).expect(200);
    expect(mine.body.map((i: any) => i.id)).not.toContain(created.body.id);
  });

  it('answers 404 for tasks of a soft-deleted team and for sprint creation on it', async () => {
    const sprint = await createSprint('ספרינט למחיקה', '2026-03-01', '2026-03-14');
    await prisma.team.update({ where: { id: teamId }, data: { deletedAt: new Date() } });
    await api().get(`/teams/${teamId}/action-items`).set(auth(adminToken)).expect(404);
    await api().post(`/sprints/${sprint}/action-items`).set(auth(adminToken)).send({ title: 'x' }).expect(404);
    await prisma.team.update({ where: { id: teamId }, data: { deletedAt: null } });
  });
});
