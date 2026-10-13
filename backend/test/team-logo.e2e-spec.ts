import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(30000);

// Feature 19 (product-backlog/19-team-logo.md) — team logo upload / serve / remove + the public
// invite-token variant. The approver is an allowlisted real address, safe only because this suite
// runs against the isolated test database.
describe('Team logo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(32)]);
  const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  const admin = { username: 'test_e2e_logo_admin', email: 'test_e2e_logo_admin@example.com', password: 'password123' };
  const approver = { username: 'test_e2e_logo_approver', email: 'lironka13@gmail.com', password: 'password123' };
  const member = { username: 'test_e2e_logo_member', email: 'test_e2e_logo_member@example.com', password: 'password123' };
  const leader = { username: 'test_e2e_logo_leader', email: 'test_e2e_logo_leader@example.com', password: 'password123' };
  const outsider = { username: 'test_e2e_logo_outsider', email: 'test_e2e_logo_outsider@example.com', password: 'password123' };

  let adminToken: string;
  let approverToken: string;
  let memberToken: string;
  let leaderToken: string;
  let outsiderToken: string;
  let teamId: number;
  let otherTeamId: number;
  let pendingTeamId: number;

  async function registerAndLogin(user: { username: string; email: string; password: string }) {
    const res = await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);
    tracker.trackUser(res.body.user.id);
    return { id: res.body.user.id as number, token: res.body.accessToken as string };
  }

  async function createActiveTeam(name: string) {
    const res = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, approverEmail: approver.email })
      .expect(201);
    tracker.trackTeam(res.body.id);
    await request(app.getHttpServer()).post(`/teams/${res.body.id}/approve`).set('Authorization', `Bearer ${approverToken}`).expect(201);
    return res.body.id as number;
  }

  async function joinViaLink(teamIdToJoin: number, userToken: string, role?: string) {
    const invite = await request(app.getHttpServer())
      .post(`/teams/${teamIdToJoin}/invites`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(role ? { role } : {})
      .expect(201);
    await request(app.getHttpServer()).post(`/invites/${invite.body.token}/consume`).set('Authorization', `Bearer ${userToken}`).expect(201);
  }

  const upload = (id: number, token: string, file: Buffer | null, filename = 'logo.png', accentHue?: string) => {
    const req = request(app.getHttpServer()).put(`/teams/${id}/logo`).set('Authorization', `Bearer ${token}`);
    if (file) req.attach('file', file, filename);
    if (accentHue !== undefined) req.field('accentHue', accentHue);
    return req;
  };

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({
      where: { OR: [{ username: { startsWith: 'test_e2e_logo_' } }, { email: { in: [approver.email] } }] },
    });
    await app.init();

    adminToken = (await registerAndLogin(admin)).token;
    approverToken = (await registerAndLogin(approver)).token;
    memberToken = (await registerAndLogin(member)).token;
    leaderToken = (await registerAndLogin(leader)).token;
    outsiderToken = (await registerAndLogin(outsider)).token;

    teamId = await createActiveTeam('E2E Logo Team');
    otherTeamId = await createActiveTeam('E2E Logo Other Team');
    await joinViaLink(teamId, memberToken);
    await joinViaLink(teamId, leaderToken, 'TEAM_LEADER');

    const pending = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Logo Pending Team', approverEmail: approver.email })
      .expect(201);
    pendingTeamId = pending.body.id;
    tracker.trackTeam(pendingTeamId);
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  describe('authorisation', () => {
    it('rejects every endpoint without a token', async () => {
      await request(app.getHttpServer()).put(`/teams/${teamId}/logo`).attach('file', PNG, 'logo.png').expect(401);
      await request(app.getHttpServer()).delete(`/teams/${teamId}/logo`).expect(401);
      await request(app.getHttpServer()).patch(`/teams/${teamId}/accent`).send({ accentHue: 10 }).expect(401);
      await request(app.getHttpServer()).get(`/teams/${teamId}/logo`).expect(401);
    });

    it('only an admin can upload: a regular member, a non-admin TEAM_LEADER and an outsider get 403', async () => {
      await upload(teamId, memberToken, PNG).expect(403);
      await upload(teamId, leaderToken, PNG).expect(403);
      await upload(teamId, outsiderToken, PNG).expect(403);
      await request(app.getHttpServer()).delete(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${leaderToken}`).expect(403);
      await request(app.getHttpServer()).patch(`/teams/${teamId}/accent`).set('Authorization', `Bearer ${memberToken}`).send({ accentHue: 10 }).expect(403);
    });

    it('404 for a team that does not exist, 409 for a team still awaiting approval', async () => {
      await upload(999999, adminToken, PNG).expect(404);
      await upload(pendingTeamId, adminToken, PNG).expect(409);
    });
  });

  describe('upload validation', () => {
    it('400 when there is no file', () => upload(teamId, adminToken, null).expect(400));

    it('400 for an SVG, even when it claims to be a PNG (the server trusts the bytes, not the name)', async () => {
      await upload(teamId, adminToken, SVG, 'logo.svg').expect(400);
      await upload(teamId, adminToken, SVG, 'logo.png').expect(400);
    });

    it('400 for an oversize file (over 512KB)', () =>
      upload(teamId, adminToken, Buffer.concat([PNG, Buffer.alloc(600 * 1024)])).expect(400));

    it.each(['360', '-1', 'abc', '1.5'])('400 for accentHue %j', (hue) => upload(teamId, adminToken, PNG, 'logo.png', hue).expect(400));

    it('a rejected upload leaves the team without a logo', async () => {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      expect(team?.logoUpdatedAt).toBeNull();
    });
  });

  describe('upload, serve, replace, remove', () => {
    it('admin uploads a PNG with a team colour; GET returns the same bytes with safe caching headers', async () => {
      const res = await upload(teamId, adminToken, PNG, 'logo.png', '172').expect(200);
      expect(res.body.accentHue).toBe(172);
      expect(res.body.logoUpdatedAt).toBeTruthy();

      const get = await request(app.getHttpServer())
        .get(`/teams/${teamId}/logo`)
        .set('Authorization', `Bearer ${memberToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(get.headers['content-type']).toMatch(/^image\/png/);
      expect(get.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      expect(get.headers['x-content-type-options']).toBe('nosniff');
      expect((get.body as Buffer).equals(PNG)).toBe(true);
    });

    it('GET /teams/user/me carries logoUpdatedAt + accentHue but never the image bytes', async () => {
      const res = await request(app.getHttpServer()).get('/teams/user/me').set('Authorization', `Bearer ${memberToken}`).expect(200);
      const team = res.body.find((t: any) => t.id === teamId);
      expect(team.logoUpdatedAt).toBeTruthy();
      expect(team.accentHue).toBe(172);
      expect(team.logo).toBeUndefined();
    });

    it('an outsider cannot read the logo (403), and a team without a logo is 404', async () => {
      await request(app.getHttpServer()).get(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${outsiderToken}`).expect(403);
      await request(app.getHttpServer()).get(`/teams/${otherTeamId}/logo`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    });

    it('replacing with a JPEG swaps the stored type and bumps logoUpdatedAt (the cache-buster)', async () => {
      const before = await prisma.team.findUnique({ where: { id: teamId } });
      await new Promise((r) => setTimeout(r, 15));
      await upload(teamId, adminToken, JPEG, 'logo.jpg').expect(200);

      const after = await prisma.team.findUnique({ where: { id: teamId } });
      expect(after!.logoUpdatedAt!.getTime()).toBeGreaterThan(before!.logoUpdatedAt!.getTime());
      expect(after!.accentHue).toBeNull(); // no hue sent = no team colour

      const get = await request(app.getHttpServer()).get(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${adminToken}`).expect(200);
      expect(get.headers['content-type']).toMatch(/^image\/jpeg/);
    });

    it('PATCH /teams/:id/accent changes just the colour (and null clears it)', async () => {
      const before = await prisma.team.findUnique({ where: { id: teamId } });
      const res = await request(app.getHttpServer())
        .patch(`/teams/${teamId}/accent`).set('Authorization', `Bearer ${adminToken}`).send({ accentHue: 200 }).expect(200);
      expect(res.body.accentHue).toBe(200);
      const after = await prisma.team.findUnique({ where: { id: teamId } });
      expect(after!.logoUpdatedAt!.getTime()).toBe(before!.logoUpdatedAt!.getTime());

      await request(app.getHttpServer())
        .patch(`/teams/${teamId}/accent`).set('Authorization', `Bearer ${adminToken}`).send({ accentHue: null }).expect(200);
      await request(app.getHttpServer())
        .patch(`/teams/${teamId}/accent`).set('Authorization', `Bearer ${adminToken}`).send({ accentHue: 400 }).expect(400);
    });

    it('DELETE removes the logo and the colour, and is idempotent', async () => {
      await upload(teamId, adminToken, PNG, 'logo.png', '90').expect(200);
      await request(app.getHttpServer()).delete(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${adminToken}`).expect(200);

      const team = await prisma.team.findUnique({ where: { id: teamId } });
      expect(team!.logoUpdatedAt).toBeNull();
      expect(team!.accentHue).toBeNull();
      expect(await prisma.teamLogo.count({ where: { teamId } })).toBe(0);
      await request(app.getHttpServer()).get(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${adminToken}`).expect(404);

      await request(app.getHttpServer()).delete(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    });

    it('deleting the team deletes its logo row (Cascade)', async () => {
      const id = await createActiveTeam('E2E Logo Cascade Team');
      await upload(id, adminToken, PNG).expect(200);
      expect(await prisma.teamLogo.count({ where: { teamId: id } })).toBe(1);
      await prisma.team.delete({ where: { id } });
      expect(await prisma.teamLogo.count({ where: { teamId: id } })).toBe(0);
    });
  });

  describe('invite-token logo (public — the invitee is not logged in yet)', () => {
    let inviteToken: string;
    let otherInviteToken: string;

    beforeAll(async () => {
      await upload(teamId, adminToken, PNG, 'logo.png', '172').expect(200);
      const a = await request(app.getHttpServer()).post(`/teams/${teamId}/invites`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(201);
      inviteToken = a.body.token;
      const b = await request(app.getHttpServer()).post(`/teams/${otherTeamId}/invites`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(201);
      otherInviteToken = b.body.token;
    });

    it('GET /invites/:token exposes logoUpdatedAt + accentHue for a usable invite', async () => {
      const res = await request(app.getHttpServer()).get(`/invites/${inviteToken}`).expect(200);
      expect(res.body).toMatchObject({ valid: true, accentHue: 172 });
      expect(res.body.logoUpdatedAt).toBeTruthy();
    });

    it('GET /invites/:token/logo serves the logo with no Authorization header', async () => {
      const res = await request(app.getHttpServer()).get(`/invites/${inviteToken}/logo`).expect(200);
      expect(res.headers['content-type']).toMatch(/^image\/png/);
    });

    it('serves only the invite\'s OWN team: a token for a team without a logo is 404, not another team\'s logo', async () => {
      await request(app.getHttpServer()).get(`/invites/${otherInviteToken}/logo`).expect(404);
    });

    it('404 for an unknown token, 400 for a malformed one', async () => {
      await request(app.getHttpServer()).get('/invites/doesnotexist1234/logo').expect(404);
      await request(app.getHttpServer()).get('/invites/bad%20token/logo').expect(400);
    });

    it('a revoked invite stops serving the logo and stops advertising it', async () => {
      const created = await request(app.getHttpServer()).post(`/teams/${teamId}/invites`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(201);
      await request(app.getHttpServer()).get(`/invites/${created.body.token}/logo`).expect(200);

      await request(app.getHttpServer())
        .patch(`/teams/${teamId}/invites/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ isRevoked: true }).expect(200);

      await request(app.getHttpServer()).get(`/invites/${created.body.token}/logo`).expect(404);
      const info = await request(app.getHttpServer()).get(`/invites/${created.body.token}`).expect(200);
      expect(info.body.valid).toBe(false);
      expect(info.body.logoUpdatedAt).toBeNull();
      expect(info.body.accentHue).toBeNull();
    });
  });

  describe('PENDING members', () => {
    it('an invited-but-not-yet-accepted member can already see the logo', async () => {
      const pendingUser = await registerAndLogin({ username: 'test_e2e_logo_pending', email: 'test_e2e_logo_pending@example.com', password: 'password123' });
      await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`).set('Authorization', `Bearer ${adminToken}`).send({ username: 'test_e2e_logo_pending', role: 'DEVELOPER' }).expect(201);
      await request(app.getHttpServer()).get(`/teams/${teamId}/logo`).set('Authorization', `Bearer ${pendingUser.token}`).expect(200);
    });
  });
});
