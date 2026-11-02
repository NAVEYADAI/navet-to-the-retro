import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(90000);

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// Feature 13 (product-backlog/13-comment-edit-delete.md): edit / soft-delete a comment, the sprint
// write window and per-member extensions. The approver is an allowlisted real address — safe only
// because this suite runs against the isolated test database.
describe('Comment edit / delete + write window (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const mk = (n: string) => ({ username: `test_e2e_ced_${n}`, email: `test_e2e_ced_${n}@example.com`, password: 'password123' });
  const users = { admin: mk('admin'), lead: mk('lead'), m1: mk('m1'), m2: mk('m2'), m3: mk('m3'), m4: mk('m4'), out: mk('out') };
  const approver = { username: 'test_e2e_ced_approver', email: 'lironka13@gmail.com', password: 'password123' };

  const tok: Record<string, string> = {};
  const id: Record<string, number> = {};
  let teamId: number;
  let openSprint: number; // ends tomorrow: inside the write window
  let recentSprint: number; // ended 3 days ago: last writable day
  let lockedSprint: number; // ended 4 days ago: locked

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = () => request(app.getHttpServer());

  async function register(key: string, u: { username: string; email: string; password: string }) {
    const res = await api().post('/auth/register').send(u).expect(201);
    tracker.trackUser(res.body.user.id);
    tok[key] = res.body.accessToken;
    id[key] = res.body.user.id;
  }

  async function join(key: string, role?: string) {
    const invite = await api().post(`/teams/${teamId}/invites`).set(auth(tok.admin)).send(role ? { role } : {}).expect(201);
    await api().post(`/invites/${invite.body.token}/consume`).set(auth(tok[key])).expect(201);
  }

  const sprint = async (name: string, startOffset: number, endOffset: number) =>
    (await api().post(`/teams/${teamId}/sprints`).set(auth(tok.admin)).send({ name, startDate: isoDay(startOffset), endDate: isoDay(endOffset) }).expect(201)).body.id as number;

  const post = (sprintId: number, key: string, body: object = {}) =>
    api().post(`/sprints/${sprintId}/comments`).set(auth(tok[key])).send({ content: 'hello', type: 'KEEP', ...body });
  const list = async (sprintId: number, key: string) => (await api().get(`/sprints/${sprintId}/comments`).set(auth(tok[key])).expect(200)).body as any[];
  // Inserted directly: used to put comments into a sprint that is already locked for the API.
  const insertComment = async (sprintId: number, authorKey: string, content: string, extra: object = {}) =>
    (await prisma.comment.create({ data: { content, type: 'KEEP', authorId: id[authorKey], teamId, sprintId, ...extra } })).id;

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany({ where: { OR: [{ username: { startsWith: 'test_e2e_ced_' } }, { email: approver.email }] } });
    await app.init();

    for (const [k, u] of Object.entries(users)) await register(k, u);
    await register('approver', approver);

    const res = await api().post('/teams').set(auth(tok.admin)).send({ name: 'ced-team', approverEmail: approver.email }).expect(201);
    teamId = res.body.id;
    tracker.trackTeam(teamId);
    await api().post(`/teams/${teamId}/approve`).set(auth(tok.approver)).expect(201);
    await join('lead', 'TEAM_LEADER');
    await join('m1');
    await join('m2');
    await join('m3');
    await join('m4');

    openSprint = await sprint('open', -5, 1);
    recentSprint = await sprint('recent', -20, -3);
    lockedSprint = await sprint('locked', -20, -4);
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  describe('write window', () => {
    it('allows writing in an open sprint and on the 3rd day after it ended, locks on the 4th', async () => {
      await post(openSprint, 'm1').expect(201);
      await post(recentSprint, 'm1').expect(201);
      const res = await post(lockedSprint, 'm1').expect(403);
      expect(res.body.message).toBe('הלוח נעול לכתיבה — הספרינט הסתיים');
    });

    it('write-access tells the board whether it is writable', async () => {
      expect((await api().get(`/sprints/${openSprint}/write-access`).set(auth(tok.m1)).expect(200)).body)
        .toMatchObject({ canWrite: true, windowOpen: true, extensionExpiresAt: null, anonymousAllowed: true });
      expect((await api().get(`/sprints/${lockedSprint}/write-access`).set(auth(tok.m1)).expect(200)).body)
        .toMatchObject({ canWrite: false, windowOpen: false, extensionExpiresAt: null, anonymousAllowed: false });
      await api().get(`/sprints/${lockedSprint}/write-access`).set(auth(tok.out)).expect(404);
      await api().get(`/sprints/${lockedSprint}/write-access`).expect(401);
    });
  });

  describe('edit', () => {
    let named: number; let anon: number;

    beforeAll(async () => {
      named = (await post(openSprint, 'm1', { content: 'original' })).body.id;
      anon = (await post(openSprint, 'm1', { content: 'secret', isAnonymous: true })).body.id;
    });

    it('the writer edits content, moves it to the other column and gets an "edited" timestamp; highlight is kept', async () => {
      await api().patch(`/comments/${named}/highlight`).set(auth(tok.admin)).send({ isHighlighted: true }).expect(200);
      const res = await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ content: 'fixed', type: 'IMPROVE' }).expect(200);
      expect(res.body).toMatchObject({ content: 'fixed', type: 'IMPROVE', isHighlighted: true, isMine: true, canEdit: true });
      expect(res.body.updatedAt).toEqual(expect.any(String));
      const board = (await list(openSprint, 'm1')).find(c => c.id === named);
      expect(board).toMatchObject({ content: 'fixed', type: 'IMPROVE', isMine: true, canEdit: true, canDelete: true });
      expect(board.updatedAt).toEqual(expect.any(String));
    });

    it('a comment that was never edited has no updatedAt', async () => {
      const board = (await list(openSprint, 'm2')).find(c => c.id === named);
      expect(board).toBeDefined();
      const fresh = (await post(openSprint, 'm1', { content: 'fresh' })).body.id;
      expect((await list(openSprint, 'm2')).find(c => c.id === fresh).updatedAt).toBeNull();
    });

    it('another member cannot edit it, and sees no edit rights', async () => {
      await api().patch(`/comments/${named}`).set(auth(tok.m2)).send({ content: 'hax' }).expect(403);
      const board = (await list(openSprint, 'm2')).find(c => c.id === named);
      expect(board).toMatchObject({ isMine: false, canEdit: false, canDelete: false });
    });

    it('not even the admin or a team leader can rewrite it', async () => {
      await api().patch(`/comments/${named}`).set(auth(tok.admin)).send({ content: 'hax' }).expect(403);
      await api().patch(`/comments/${named}`).set(auth(tok.lead)).send({ content: 'hax' }).expect(403);
    });

    it('an outsider gets 404, an unauthenticated caller 401', async () => {
      await api().patch(`/comments/${named}`).set(auth(tok.out)).send({ content: 'x' }).expect(404);
      await api().patch(`/comments/${named}`).send({ content: 'x' }).expect(401);
    });

    it('my anonymous comment: editable, flagged isMine only for me, authorId never exposed (BUG-02)', async () => {
      const res = await api().patch(`/comments/${anon}`).set(auth(tok.m1)).send({ content: 'secret v2' }).expect(200);
      expect(res.body).not.toHaveProperty('authorId');
      expect(res.body.author.username).toBe('Anonymous');
      expect(res.body).toMatchObject({ content: 'secret v2', isMine: true, canEdit: true });

      for (const key of ['m1', 'm2', 'admin', 'lead']) {
        const c = (await list(openSprint, key)).find(x => x.id === anon);
        expect(c).not.toHaveProperty('authorId');
        expect(c.author.username).toBe('Anonymous');
        expect(c.isMine).toBe(key === 'm1');
        expect(c.canEdit).toBe(key === 'm1');
      }
    });

    it('cannot make an anonymous comment named (or the reverse)', async () => {
      await api().patch(`/comments/${anon}`).set(auth(tok.m1)).send({ isAnonymous: false }).expect(400);
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ isAnonymous: true }).expect(400);
    });

    it('validates the body', async () => {
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({}).expect(400);
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ content: '  ' }).expect(400);
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ type: 'LOVE' }).expect(400);
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ categoryId: 'x' }).expect(400);
      await api().patch(`/comments/abc`).set(auth(tok.m1)).send({ content: 'x' }).expect(400);
    });

    it('categoryId must be a category of the same team (and can be cleared)', async () => {
      const cats = (await api().get(`/teams/${teamId}/categories`).set(auth(tok.m1)).expect(200)).body as any[];
      const cat = cats.find(c => c.isEnabled);
      expect(cat).toBeDefined();
      await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ categoryId: 2147483000 }).expect(404);
      const set = await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ categoryId: cat.id }).expect(200);
      expect(set.body.category).toMatchObject({ id: cat.id });
      const cleared = await api().patch(`/comments/${named}`).set(auth(tok.m1)).send({ categoryId: null }).expect(200);
      expect(cleared.body.category).toBeNull();
    });

    it('a comment posted in someone\'s name can be edited by both sides', async () => {
      const behalf = (await post(openSprint, 'admin', { content: 'on behalf', onBehalfOfUserId: id.m2 })).body.id;
      await api().patch(`/comments/${behalf}`).set(auth(tok.admin)).send({ content: 'by poster' }).expect(200);
      await api().patch(`/comments/${behalf}`).set(auth(tok.m2)).send({ content: 'by subject' }).expect(200);
      await api().patch(`/comments/${behalf}`).set(auth(tok.m1)).send({ content: 'by stranger' }).expect(403);
      const forM2 = (await list(openSprint, 'm2')).find(c => c.id === behalf);
      const forAdmin = (await list(openSprint, 'admin')).find(c => c.id === behalf);
      expect(forM2).toMatchObject({ isMine: true, canEdit: true });
      expect(forAdmin).toMatchObject({ isMine: true, canEdit: true });
    });

    it('a locked sprint cannot be edited (even by its writer); an extension reopens it; an expired one does not', async () => {
      const old = await insertComment(lockedSprint, 'm1', 'from the past');
      const res = await api().patch(`/comments/${old}`).set(auth(tok.m1)).send({ content: 'late edit' }).expect(403);
      expect(res.body.message).toBe('הלוח נעול לכתיבה — הספרינט הסתיים');
      expect((await list(lockedSprint, 'm1')).find(c => c.id === old)).toMatchObject({ isMine: true, canEdit: false, canDelete: false });

      const expired = await prisma.sprintWriteExtension.create({
        data: { sprintId: lockedSprint, userId: id.m1, grantedById: id.admin, expiresAt: new Date(Date.now() - 1000) }
      });
      await api().patch(`/comments/${old}`).set(auth(tok.m1)).send({ content: 'late edit' }).expect(403);
      await prisma.sprintWriteExtension.delete({ where: { id: expired.id } });

      await prisma.sprintWriteExtension.create({
        data: { sprintId: lockedSprint, userId: id.m1, grantedById: id.admin, expiresAt: new Date(Date.now() + DAY) }
      });
      await api().patch(`/comments/${old}`).set(auth(tok.m1)).send({ content: 'late edit' }).expect(200);
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });
  });

  describe('delete (soft)', () => {
    it('the writer deletes: it disappears from the board, the row stays with deletedAt/deletedById', async () => {
      const cid = (await post(openSprint, 'm1', { content: 'to delete' })).body.id;
      await api().delete(`/comments/${cid}`).set(auth(tok.m1)).expect(200);
      expect((await list(openSprint, 'm2')).some(c => c.id === cid)).toBe(false);
      const row = await prisma.comment.findUnique({ where: { id: cid } });
      expect(row).toMatchObject({ deletedById: id.m1 });
      expect(row!.deletedAt).toBeInstanceOf(Date);
      // a second delete / edit / highlight of a deleted comment is a 404
      await api().delete(`/comments/${cid}`).set(auth(tok.m1)).expect(404);
      await api().patch(`/comments/${cid}`).set(auth(tok.m1)).send({ content: 'x' }).expect(404);
      await api().patch(`/comments/${cid}/highlight`).set(auth(tok.admin)).send({ isHighlighted: true }).expect(404);
    });

    it('a deleted comment is gone from the category counts and the focus-point flow (the export filter is unit-tested in sprints.service.spec)', async () => {
      const cats = (await api().get(`/teams/${teamId}/categories`).set(auth(tok.m1)).expect(200)).body as any[];
      const cat = cats.find(c => c.isEnabled);
      const cid = (await post(openSprint, 'm1', { content: 'counted', categoryId: cat.id })).body.id;
      const count = async () => ((await api().get(`/teams/${teamId}/categories`).set(auth(tok.m1)).expect(200)).body as any[]).find(c => c.id === cat.id).commentCount;
      const before = await count();

      await api().post(`/comments/${cid}/propose`).set(auth(tok.m1)).expect(201);
      expect(((await api().get(`/teams/${teamId}/focus-point-proposals`).set(auth(tok.admin)).expect(200)).body as any[]).some(p => p.commentId === cid)).toBe(true);

      await api().delete(`/comments/${cid}`).set(auth(tok.m1)).expect(200);

      expect(await count()).toBe(before - 1);
      expect(((await api().get(`/teams/${teamId}/focus-point-proposals`).set(auth(tok.admin)).expect(200)).body as any[]).some(p => p.commentId === cid)).toBe(false);
      await api().post(`/comments/${cid}/propose`).set(auth(tok.m2)).expect(404);
      await api().post(`/teams/${teamId}/focus-points`).set(auth(tok.admin)).send({ kind: 'IMPROVE', text: 'x', initialScore: 3, sourceCommentIds: [cid] }).expect(400);
    });

    it('a team leader and another member cannot delete someone else\'s comment', async () => {
      const cid = (await post(openSprint, 'm1', { content: 'protected' })).body.id;
      await api().delete(`/comments/${cid}`).set(auth(tok.m2)).expect(403);
      await api().delete(`/comments/${cid}`).set(auth(tok.lead)).expect(403);
      await api().delete(`/comments/${cid}`).set(auth(tok.out)).expect(404);
      await api().delete(`/comments/${cid}`).expect(401);
    });

    it('the writer cannot delete once the board is locked, but an admin can (moderation, any sprint)', async () => {
      const old = await insertComment(lockedSprint, 'm1', 'old and rude');
      const res = await api().delete(`/comments/${old}`).set(auth(tok.m1)).expect(403);
      expect(res.body.message).toBe('הלוח נעול לכתיבה — הספרינט הסתיים');
      expect((await list(lockedSprint, 'admin')).find(c => c.id === old)).toMatchObject({ canEdit: false, canDelete: true });
      await api().delete(`/comments/${old}`).set(auth(tok.admin)).expect(200);
      expect((await list(lockedSprint, 'm2')).some(c => c.id === old)).toBe(false);
    });
  });

  describe('deleted comments panel (admin only)', () => {
    it('lists deleted comments with who deleted them; anonymous ones stay masked and a self-deletion never names the writer', async () => {
      const modAnon = await insertComment(lockedSprint, 'm2', 'anon rude', { isAnonymous: true });
      const selfAnon = (await post(openSprint, 'm1', { content: 'anon regret', isAnonymous: true })).body.id;
      const named = (await post(openSprint, 'm1', { content: 'named removed' })).body.id;
      await api().delete(`/comments/${modAnon}`).set(auth(tok.admin)).expect(200);
      await api().delete(`/comments/${selfAnon}`).set(auth(tok.m1)).expect(200);
      await api().delete(`/comments/${named}`).set(auth(tok.admin)).expect(200);

      const lockedList = (await api().get(`/sprints/${lockedSprint}/comments/deleted`).set(auth(tok.admin)).expect(200)).body as any[];
      const mod = lockedList.find(c => c.id === modAnon);
      expect(mod).not.toHaveProperty('authorId');
      expect(mod.author.username).toBe('Anonymous');
      expect(mod.deletedBy).toMatchObject({ id: id.admin });
      expect(mod.deletedAt).toEqual(expect.any(String));

      const openList = (await api().get(`/sprints/${openSprint}/comments/deleted`).set(auth(tok.admin)).expect(200)).body as any[];
      const self = openList.find(c => c.id === selfAnon);
      expect(self.deletedBy).toBeNull();
      expect(self.deletedByAuthor).toBe(true);
      expect(JSON.stringify(self)).not.toContain(users.m1.username);
      expect(self).not.toHaveProperty('authorId');
      expect(openList.find(c => c.id === named)).toMatchObject({ content: 'named removed', deletedBy: { id: id.admin } });
    });

    it('is closed to team leaders, plain members and outsiders', async () => {
      await api().get(`/sprints/${openSprint}/comments/deleted`).set(auth(tok.lead)).expect(403);
      await api().get(`/sprints/${openSprint}/comments/deleted`).set(auth(tok.m1)).expect(403);
      await api().get(`/sprints/${openSprint}/comments/deleted`).set(auth(tok.out)).expect(404);
      await api().get(`/sprints/${openSprint}/comments/deleted`).expect(401);
    });
  });

  describe('write extensions', () => {
    it('only an admin grants; the member can then write to the locked sprint until it is revoked', async () => {
      await post(lockedSprint, 'm2').expect(403);

      const body = { userId: id.m2, expiresAt: isoDay(2) };
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.lead)).send(body).expect(403);
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.m2)).send(body).expect(403);
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.out)).send(body).expect(404);
      await api().post(`/sprints/${lockedSprint}/write-extensions`).send(body).expect(401);

      const granted = await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send(body).expect(201);
      expect(granted.body).toMatchObject({ sprintId: lockedSprint, userId: id.m2, grantedById: id.admin });

      const access = (await api().get(`/sprints/${lockedSprint}/write-access`).set(auth(tok.m2)).expect(200)).body;
      expect(access).toMatchObject({ canWrite: true, windowOpen: false });
      expect(new Date(access.extensionExpiresAt).getTime()).toBeGreaterThan(Date.now());

      const mine = (await post(lockedSprint, 'm2', { content: 'extended' }).expect(201)).body;
      expect(mine).toMatchObject({ isMine: true, canEdit: true });
      await api().patch(`/comments/${mine.id}`).set(auth(tok.m2)).send({ content: 'extended v2' }).expect(200);
      // the extension is per user: m1 is still locked out
      await post(lockedSprint, 'm1').expect(403);

      // listing: the admin sees everyone's, a member only their own
      expect(((await api().get(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).expect(200)).body as any[]).map(e => e.userId)).toEqual([id.m2]);
      expect((await api().get(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.m1)).expect(200)).body).toEqual([]);
      expect((await api().get(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.m2)).expect(200)).body).toHaveLength(1);

      await api().delete(`/sprints/${lockedSprint}/write-extensions/${granted.body.id}`).set(auth(tok.lead)).expect(403);
      await api().delete(`/sprints/${lockedSprint}/write-extensions/${granted.body.id}`).set(auth(tok.admin)).expect(200);
      await api().delete(`/sprints/${lockedSprint}/write-extensions/${granted.body.id}`).set(auth(tok.admin)).expect(404);
      await post(lockedSprint, 'm2').expect(403);
      await api().patch(`/comments/${mine.id}`).set(auth(tok.m2)).send({ content: 'after revoke' }).expect(403);
    });

    it('granting again replaces the previous extension of that member', async () => {
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(5) }).expect(201);
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(1) }).expect(201);
      expect(await prisma.sprintWriteExtension.count({ where: { sprintId: lockedSprint, userId: id.m2 } })).toBe(1);
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('validates the target and the date', async () => {
      const url = `/sprints/${lockedSprint}/write-extensions`;
      await api().post(url).set(auth(tok.admin)).send({ expiresAt: isoDay(2) }).expect(400);
      await api().post(url).set(auth(tok.admin)).send({ userId: id.m2 }).expect(400);
      await api().post(url).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: 'soon' }).expect(400);
      await api().post(url).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(-2) }).expect(400);
      // not a member of the team
      await api().post(url).set(auth(tok.admin)).send({ userId: id.out, expiresAt: isoDay(2) }).expect(404);
    });

    it('caps an extension at 30 days from today (400 + Hebrew message); exactly 30 days is fine', async () => {
      const url = `/sprints/${lockedSprint}/write-extensions`;
      const tooFar = await api().post(url).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(40) }).expect(400);
      expect(tooFar.body.message).toBe('אפשר להאריך את חלון הכתיבה עד 30 ימים קדימה בלבד');
      await api().post(url).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: '2099-01-01' }).expect(400);
      await api().post(url).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(29) }).expect(201);
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('the database allows one extension per (sprint, member)', async () => {
      await prisma.sprintWriteExtension.create({ data: { sprintId: lockedSprint, userId: id.m2, expiresAt: new Date(Date.now() + DAY) } });
      await expect(
        prisma.sprintWriteExtension.create({ data: { sprintId: lockedSprint, userId: id.m2, expiresAt: new Date(Date.now() + DAY) } })
      ).rejects.toThrow();
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('a member removed from the team loses their extensions (and a re-invited one does not get them back)', async () => {
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m3, expiresAt: isoDay(5) }).expect(201);
      await api().post(`/sprints/${recentSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m3, expiresAt: isoDay(5) }).expect(201);
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m1, expiresAt: isoDay(5) }).expect(201);
      const m3Member = await prisma.teamMember.findFirstOrThrow({ where: { userId: id.m3, teamId } });

      await api().delete(`/teams/${teamId}/members/${m3Member.id}`).set(auth(tok.admin)).expect(200);

      expect(await prisma.sprintWriteExtension.count({ where: { userId: id.m3 } })).toBe(0);
      // someone else's extension is untouched
      expect(await prisma.sprintWriteExtension.count({ where: { userId: id.m1, sprintId: lockedSprint } })).toBe(1);
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('a member who leaves the team loses their extensions', async () => {
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m4, expiresAt: isoDay(5) }).expect(201);
      expect(await prisma.sprintWriteExtension.count({ where: { userId: id.m4 } })).toBe(1);

      await api().post(`/teams/${teamId}/leave`).set(auth(tok.m4)).send({}).expect(201);

      expect(await prisma.sprintWriteExtension.count({ where: { userId: id.m4 } })).toBe(0);
    });
  });

  describe('anonymous comments and the write extension (security)', () => {
    afterEach(async () => {
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('with an extension on a locked sprint a named comment works, an anonymous one is refused (403)', async () => {
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(2) }).expect(201);

      const access = (await api().get(`/sprints/${lockedSprint}/write-access`).set(auth(tok.m2)).expect(200)).body;
      expect(access).toMatchObject({ canWrite: true, windowOpen: false, anonymousAllowed: false });

      const refused = await post(lockedSprint, 'm2', { isAnonymous: true }).expect(403);
      expect(refused.body.message).toBe('אי אפשר לפרסם הערה אנונימית אחרי שהלוח ננעל — מועד הפרסום היה חושף מי כתב אותה');
      expect(await prisma.comment.count({ where: { sprintId: lockedSprint, authorId: id.m2, content: 'hello' } })).toBe(0);

      await post(lockedSprint, 'm2', { isAnonymous: false, content: 'named via extension' }).expect(201);
    });

    it('inside the normal window anonymous is still allowed, and write-access says so', async () => {
      await post(openSprint, 'm2', { isAnonymous: true }).expect(201);
      await post(recentSprint, 'm2', { isAnonymous: true }).expect(201);
      expect((await api().get(`/sprints/${recentSprint}/write-access`).set(auth(tok.m2)).expect(200)).body).toMatchObject({ windowOpen: true, anonymousAllowed: true });
    });

    it('PATCH never changes anonymity, extension or not', async () => {
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(2) }).expect(201);
      const c = (await post(lockedSprint, 'm2', { content: 'to patch' }).expect(201)).body;
      await api().patch(`/comments/${c.id}`).set(auth(tok.m2)).send({ isAnonymous: true }).expect(400);
      await api().patch(`/comments/${c.id}`).set(auth(tok.m2)).send({ isAnonymous: false, content: 'x' }).expect(400);
    });
  });

  describe('existing anonymous comments after the board locks (security)', () => {
    afterEach(async () => {
      await prisma.sprintWriteExtension.deleteMany({ where: { sprintId: lockedSprint } });
    });

    it('the writer cannot edit or delete their anonymous comment through an extension (403), and the board says so', async () => {
      const cid = await insertComment(lockedSprint, 'm2', 'secret', { isAnonymous: true });
      await api().post(`/sprints/${lockedSprint}/write-extensions`).set(auth(tok.admin)).send({ userId: id.m2, expiresAt: isoDay(2) }).expect(201);

      const msg = 'אי אפשר לערוך או למחוק הערה אנונימית אחרי שהלוח ננעל — מועד הפעולה היה חושף מי כתב אותה';
      expect((await api().patch(`/comments/${cid}`).set(auth(tok.m2)).send({ content: 'edited' }).expect(403)).body.message).toBe(msg);
      expect((await api().delete(`/comments/${cid}`).set(auth(tok.m2)).expect(403)).body.message).toBe(msg);

      const mine = (await api().get(`/sprints/${lockedSprint}/comments`).set(auth(tok.m2)).expect(200)).body.find((c: { id: number }) => c.id === cid);
      expect(mine).toMatchObject({ isMine: true, canEdit: false, canDelete: false });
      const row = await prisma.comment.findUnique({ where: { id: cid } });
      expect(row).toMatchObject({ content: 'secret', deletedAt: null, updatedAt: null });
    });

    it('an admin can still moderate-delete someone else\'s anonymous comment', async () => {
      const cid = await insertComment(lockedSprint, 'm2', 'bad', { isAnonymous: true });
      const asAdmin = (await api().get(`/sprints/${lockedSprint}/comments`).set(auth(tok.admin)).expect(200)).body.find((c: { id: number }) => c.id === cid);
      expect(asAdmin).toMatchObject({ isMine: false, canDelete: true });
      await api().delete(`/comments/${cid}`).set(auth(tok.admin)).expect(200);
    });
  });

  describe('content length cap', () => {
    it('create and edit accept 2000 characters and refuse 2001 (400, Hebrew message)', async () => {
      const ok = (await post(openSprint, 'm1', { content: 'a'.repeat(2000) }).expect(201)).body;
      const tooLong = await post(openSprint, 'm1', { content: 'a'.repeat(2001) }).expect(400);
      expect(tooLong.body.message).toBe('ההערה ארוכה מדי (עד 2000 תווים)');
      await api().patch(`/comments/${ok.id}`).set(auth(tok.m1)).send({ content: 'b'.repeat(2000) }).expect(200);
      const editTooLong = await api().patch(`/comments/${ok.id}`).set(auth(tok.m1)).send({ content: 'b'.repeat(2001) }).expect(400);
      expect(editTooLong.body.message).toBe('ההערה ארוכה מדי (עד 2000 תווים)');
    });
  });
});
