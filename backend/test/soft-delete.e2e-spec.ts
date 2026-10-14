import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';
import { purgeExpiredSoftDeleted } from '../src/common/soft-delete-purge';

jest.setTimeout(60000);

const DAY = 24 * 60 * 60 * 1000;

// Feature 14 (product-backlog/14-sprint-and-team-deletion.md). The approver is an allowlisted real
// address — safe only because this suite runs against the isolated test database.
describe('Sprint and team soft delete (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const admin = { username: 'test_e2e_sd_admin', email: 'test_e2e_sd_admin@example.com', password: 'password123' };
  const admin2 = { username: 'test_e2e_sd_admin2', email: 'test_e2e_sd_admin2@example.com', password: 'password123' };
  const member = { username: 'test_e2e_sd_member', email: 'test_e2e_sd_member@example.com', password: 'password123' };
  const outsider = { username: 'test_e2e_sd_outsider', email: 'test_e2e_sd_outsider@example.com', password: 'password123' };
  const approver = { username: 'test_e2e_sd_approver', email: 'lironka13@gmail.com', password: 'password123' };

  let adminToken: string; let admin2Token: string; let memberToken: string; let outsiderToken: string; let approverToken: string;
  let adminId: number;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = () => request(app.getHttpServer());

  async function registerAndLogin(user: { username: string; email: string; password: string }) {
    const res = await api().post('/auth/register').send(user).expect(201);
    tracker.trackUser(res.body.user.id);
    return { id: res.body.user.id as number, token: res.body.accessToken as string };
  }

  /** An approved team: `adminToken` + `admin2Token` are admins, `memberToken` a regular member. */
  async function createTeam(name: string) {
    const res = await api().post('/teams').set(auth(adminToken)).send({ name, approverEmail: approver.email }).expect(201);
    const id = res.body.id as number;
    tracker.trackTeam(id);
    await api().post(`/teams/${id}/approve`).set(auth(approverToken)).expect(201);
    for (const [token, isAdmin] of [[admin2Token, true], [memberToken, false]] as const) {
      const invite = await api().post(`/teams/${id}/invites`).set(auth(adminToken)).send({}).expect(201);
      await api().post(`/invites/${invite.body.token}/consume`).set(auth(token)).expect(201);
      if (isAdmin) {
        const members = await api().get(`/teams/${id}/members`).set(auth(adminToken)).expect(200);
        const m = members.body.find((x: any) => x.user.username === admin2.username);
        await api().patch(`/teams/${id}/members/${m.id}`).set(auth(adminToken)).send({ isAdmin: true }).expect(200);
      }
    }
    return id;
  }

  async function createSprint(teamId: number, name: string) {
    const res = await api().post(`/teams/${teamId}/sprints`).set(auth(adminToken))
      .send({ name, startDate: '2026-01-01', endDate: '2026-01-14' }).expect(201);
    return res.body.id as number;
  }

  const comment = (sprintId: number, token: string, content: string) =>
    api().post(`/sprints/${sprintId}/comments`).set(auth(token)).send({ content, type: 'KEEP' }).expect(201);

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({ where: { OR: [{ username: { startsWith: 'test_e2e_sd_' } }, { email: { in: [approver.email] } }] } });
    await app.init();

    ({ id: adminId, token: adminToken } = await registerAndLogin(admin));
    admin2Token = (await registerAndLogin(admin2)).token;
    memberToken = (await registerAndLogin(member)).token;
    outsiderToken = (await registerAndLogin(outsider)).token;
    approverToken = (await registerAndLogin(approver)).token;
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  describe('sprints', () => {
    let teamId: number; let sprintId: number;

    beforeAll(async () => {
      teamId = await createTeam('E2E SD Sprint Team');
      sprintId = await createSprint(teamId, 'Doomed Sprint');
      await comment(sprintId, memberToken, 'first note');
      await comment(sprintId, adminToken, 'second note');
    });

    it('a regular member, an outsider and no token cannot delete (403 / 403 / 401)', async () => {
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(memberToken)).expect(403);
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(outsiderToken)).expect(403);
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).expect(401);
      expect(await prisma.sprint.count({ where: { id: sprintId, deletedAt: null } })).toBe(1);
    });

    it('the admin deletes it: the row is kept (soft), who/when recorded, comment count returned', async () => {
      const res = await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(200);
      expect(res.body).toMatchObject({ id: sprintId, commentCount: 2 });

      const row = await prisma.sprint.findUnique({ where: { id: sprintId } });
      expect(row?.deletedAt).toBeTruthy();
      expect(row?.deletedById).toBe(adminId);
      expect(await prisma.comment.count({ where: { sprintId } })).toBe(2); // comments are not touched
    });

    it('the deleted sprint no longer exists for anyone: not in the list, comments/summary/edit/history are 404', async () => {
      const list = await api().get(`/teams/${teamId}/sprints`).set(auth(memberToken)).expect(200);
      expect(list.body.map((s: any) => s.id)).not.toContain(sprintId);

      await api().get(`/sprints/${sprintId}/comments`).set(auth(adminToken)).expect(404);
      await api().post(`/sprints/${sprintId}/comments`).set(auth(memberToken)).send({ content: 'x', type: 'KEEP' }).expect(404);
      await api().patch(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).send({ name: 'new' }).expect(404);
      await api().get(`/teams/${teamId}/sprints/${sprintId}/length-history`).set(auth(adminToken)).expect(404);
      await api().get(`/teams/${teamId}/sprints/${sprintId}/summary/export`).set(auth(adminToken)).expect(404);
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(404); // already deleted
    });

    it('only admins see "deleted sprints", with comment count and days left', async () => {
      await api().get(`/teams/${teamId}/sprints/deleted`).set(auth(memberToken)).expect(403);
      const res = await api().get(`/teams/${teamId}/sprints/deleted`).set(auth(adminToken)).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: sprintId, name: 'Doomed Sprint', commentCount: 2, daysLeft: 30 });
    });

    it('a regular member cannot restore; an admin can — and the comments are back', async () => {
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(memberToken)).expect(403);
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(admin2Token)).expect(201);

      const list = await api().get(`/teams/${teamId}/sprints`).set(auth(memberToken)).expect(200);
      expect(list.body.map((s: any) => s.id)).toContain(sprintId);
      const comments = await api().get(`/sprints/${sprintId}/comments`).set(auth(adminToken)).expect(200);
      expect(comments.body.map((c: any) => c.content).sort()).toEqual(['first note', 'second note']);
      const deleted = await api().get(`/teams/${teamId}/sprints/deleted`).set(auth(adminToken)).expect(200);
      expect(deleted.body).toHaveLength(0);
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(404); // not deleted any more
    });

    it('a Telegram chat pointed at the sprint is reset when it is deleted', async () => {
      const link = await prisma.userMessagingLink.create({
        data: { userId: adminId, channel: 'TELEGRAM', externalId: `sd-${Date.now()}`, activeTeamId: teamId, activeSprintId: sprintId, pendingCommentContent: 'half-typed' },
      });
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(200);
      const after = await prisma.userMessagingLink.findUnique({ where: { id: link.id } });
      expect(after).toMatchObject({ activeSprintId: null, pendingCommentContent: null });
      expect(after?.activeTeamId).toBe(teamId); // the team context itself is still valid
      await prisma.userMessagingLink.delete({ where: { id: link.id } });
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(201);
    });

    it('past 30 days it can no longer be restored, and the purge removes it with its comments', async () => {
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(200);
      await prisma.sprint.update({ where: { id: sprintId }, data: { deletedAt: new Date(Date.now() - 31 * DAY) } });

      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(404);

      // Listing deleted sprints runs the purge first (no scheduler, §14.0 default #4).
      const deleted = await api().get(`/teams/${teamId}/sprints/deleted`).set(auth(adminToken)).expect(200);
      expect(deleted.body).toHaveLength(0);
      expect(await prisma.sprint.count({ where: { id: sprintId } })).toBe(0);
      expect(await prisma.comment.count({ where: { sprintId } })).toBe(0);
      expect(await prisma.sprintLengthChange.count({ where: { sprintId } })).toBe(0);
    });

    it('the purge leaves a sprint that is only 29 days old, and live ones, alone', async () => {
      const young = await createSprint(teamId, 'Young deleted');
      const live = await createSprint(teamId, 'Live');
      await api().delete(`/teams/${teamId}/sprints/${young}`).set(auth(adminToken)).expect(200);
      await prisma.sprint.update({ where: { id: young }, data: { deletedAt: new Date(Date.now() - 29 * DAY) } });

      await purgeExpiredSoftDeleted(prisma);

      expect(await prisma.sprint.count({ where: { id: { in: [young, live] } } })).toBe(2);
      await api().post(`/teams/${teamId}/sprints/${young}/restore`).set(auth(adminToken)).expect(201);
    });
  });

  describe('teams', () => {
    let teamId: number; let sprintId: number; let inviteToken: string;
    const teamName = 'E2E SD Team To Delete';

    beforeAll(async () => {
      teamId = await createTeam(teamName);
      sprintId = await createSprint(teamId, 'Team sprint');
      await comment(sprintId, memberToken, 'a note');
      inviteToken = (await api().post(`/teams/${teamId}/invites`).set(auth(adminToken)).send({}).expect(201)).body.token;
    });

    it('deleting needs the exact team name, and an admin of THAT team (a member, an outsider: 403)', async () => {
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: 'wrong name' }).expect(400);
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({}).expect(400);
      await api().delete(`/teams/${teamId}`).set(auth(memberToken)).send({ confirmName: teamName }).expect(403);
      await api().delete(`/teams/${teamId}`).set(auth(outsiderToken)).send({ confirmName: teamName }).expect(403);
      await api().delete(`/teams/${teamId}`).send({ confirmName: teamName }).expect(401);
      expect(await prisma.team.count({ where: { id: teamId, deletedAt: null } })).toBe(1);
    });

    it('with the right name the team is soft-deleted: everything underneath is kept', async () => {
      await api().delete(`/teams/${teamId}`).set(auth(admin2Token)).send({ confirmName: teamName }).expect(200);

      const row = await prisma.team.findUnique({ where: { id: teamId } });
      expect(row?.deletedAt).toBeTruthy();
      expect(row?.deletedById).not.toBeNull();
      expect(await prisma.teamMember.count({ where: { teamId } })).toBe(3);
      expect(await prisma.sprint.count({ where: { teamId } })).toBe(1);
      expect(await prisma.comment.count({ where: { sprintId } })).toBe(1);
    });

    it('the team is gone for its members: not in their lists, every endpoint is 404', async () => {
      for (const token of [adminToken, memberToken]) {
        const mine = await api().get('/teams/user/me').set(auth(token)).expect(200);
        expect(mine.body.map((t: any) => t.id)).not.toContain(teamId);
      }
      await api().get(`/teams/${teamId}/members`).set(auth(memberToken)).expect(404);
      await api().patch(`/teams/${teamId}`).set(auth(adminToken)).send({ name: 'x' }).expect(404);
      await api().get(`/teams/${teamId}/sprints`).set(auth(memberToken)).expect(404);
      await api().post(`/teams/${teamId}/sprints`).set(auth(adminToken)).send({ name: 's', startDate: '2026-01-01', endDate: '2026-01-02' }).expect(404);
      await api().get(`/teams/${teamId}/categories`).set(auth(memberToken)).expect(404);
      await api().get(`/sprints/${sprintId}/comments`).set(auth(memberToken)).expect(404);
      await api().get(`/teams/${teamId}/invites`).set(auth(adminToken)).expect(404);
      await api().post(`/teams/${teamId}/leave`).set(auth(memberToken)).send({}).expect(404);
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: teamName }).expect(404);
    });

    it('invite links to the deleted team are dead', async () => {
      await api().get(`/invites/${inviteToken}`).expect(404);
      await api().get(`/invites/${inviteToken}/logo`).expect(404);
      await api().post(`/invites/${inviteToken}/consume`).set(auth(outsiderToken)).expect(404);
      expect(await prisma.teamMember.count({ where: { teamId, userId: { not: undefined }, user: { username: outsider.username } } })).toBe(0);
    });

    it('"deleted teams" lists it for the admins who were in it — not for members or outsiders', async () => {
      for (const token of [adminToken, admin2Token]) {
        const res = await api().get('/teams/deleted').set(auth(token)).expect(200);
        const found = res.body.find((t: any) => t.id === teamId);
        expect(found).toMatchObject({ name: teamName, sprintCount: 1, daysLeft: 30 });
      }
      for (const token of [memberToken, outsiderToken]) {
        const res = await api().get('/teams/deleted').set(auth(token)).expect(200);
        expect(res.body.map((t: any) => t.id)).not.toContain(teamId);
      }
    });

    it('a member cannot restore, an outsider gets 404; an admin restores everything as it was', async () => {
      await api().post(`/teams/${teamId}/restore`).set(auth(memberToken)).expect(403);
      await api().post(`/teams/${teamId}/restore`).set(auth(outsiderToken)).expect(404);
      await api().post(`/teams/${teamId}/restore`).set(auth(admin2Token)).expect(201);

      const mine = await api().get('/teams/user/me').set(auth(memberToken)).expect(200);
      expect(mine.body.map((t: any) => t.id)).toContain(teamId);
      const sprints = await api().get(`/teams/${teamId}/sprints`).set(auth(memberToken)).expect(200);
      expect(sprints.body.map((s: any) => s.id)).toContain(sprintId);
      const comments = await api().get(`/sprints/${sprintId}/comments`).set(auth(memberToken)).expect(200);
      expect(comments.body.map((c: any) => c.content)).toEqual(['a note']);
      await api().get(`/invites/${inviteToken}`).expect(200);

      const deleted = await api().get('/teams/deleted').set(auth(adminToken)).expect(200);
      expect(deleted.body.map((t: any) => t.id)).not.toContain(teamId);
    });

    it('a sprint deleted on its own stays deleted when its team is restored', async () => {
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(200);
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: teamName }).expect(200);
      await api().post(`/teams/${teamId}/restore`).set(auth(adminToken)).expect(201);

      const sprints = await api().get(`/teams/${teamId}/sprints`).set(auth(memberToken)).expect(200);
      expect(sprints.body.map((s: any) => s.id)).not.toContain(sprintId);
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(201);
    });

    it('a sprint of a deleted team cannot be restored until the team is', async () => {
      await api().delete(`/teams/${teamId}/sprints/${sprintId}`).set(auth(adminToken)).expect(200);
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: teamName }).expect(200);
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(404);
      await api().post(`/teams/${teamId}/restore`).set(auth(adminToken)).expect(201);
      await api().post(`/teams/${teamId}/sprints/${sprintId}/restore`).set(auth(adminToken)).expect(201);
    });

    it('the Telegram context of every chat pointed at the team is reset', async () => {
      const link = await prisma.userMessagingLink.create({
        data: { userId: adminId, channel: 'TELEGRAM', externalId: `sdt-${Date.now()}`, activeTeamId: teamId, activeSprintId: sprintId },
      });
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: teamName }).expect(200);
      const after = await prisma.userMessagingLink.findUnique({ where: { id: link.id } });
      expect(after).toMatchObject({ activeTeamId: null, activeSprintId: null });
      await prisma.userMessagingLink.delete({ where: { id: link.id } });
      await api().post(`/teams/${teamId}/restore`).set(auth(adminToken)).expect(201);
    });

    it('past 30 days the team is gone for good: not restorable, and the purge removes everything underneath', async () => {
      await api().delete(`/teams/${teamId}`).set(auth(adminToken)).send({ confirmName: teamName }).expect(200);
      await prisma.team.update({ where: { id: teamId }, data: { deletedAt: new Date(Date.now() - 31 * DAY) } });

      await api().post(`/teams/${teamId}/restore`).set(auth(adminToken)).expect(404);
      const deleted = await api().get('/teams/deleted').set(auth(adminToken)).expect(200); // runs the purge
      expect(deleted.body.map((t: any) => t.id)).not.toContain(teamId);

      expect(await prisma.team.count({ where: { id: teamId } })).toBe(0);
      expect(await prisma.teamMember.count({ where: { teamId } })).toBe(0);
      expect(await prisma.sprint.count({ where: { teamId } })).toBe(0);
      expect(await prisma.comment.count({ where: { teamId } })).toBe(0);
      expect(await prisma.teamInvite.count({ where: { teamId } })).toBe(0);
      expect(await prisma.teamCommentCategory.count({ where: { teamId } })).toBe(0);
    });

    it('a team awaiting approval is cancelled, not deleted (409)', async () => {
      const res = await api().post('/teams').set(auth(adminToken)).send({ name: 'E2E SD Pending', approverEmail: approver.email }).expect(201);
      tracker.trackTeam(res.body.id);
      await api().delete(`/teams/${res.body.id}`).set(auth(adminToken)).send({ confirmName: 'E2E SD Pending' }).expect(409);
    });
  });
});
