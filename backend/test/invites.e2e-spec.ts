import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(30000);

describe('Invites (e2e) — email invites for unregistered users + shareable join links', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const creator = { username: 'test_e2e_invites_creator', email: 'test_e2e_invites_creator@example.com', password: 'password123' };
  // Allowlisted approver — safe here, this suite only runs against the isolated test database.
  const approver = { username: 'test_e2e_invites_approver', email: 'lironka13@gmail.com', password: 'password123' };

  let creatorToken: string;
  let approverToken: string;
  let teamId: number;

  async function registerAndLogin(user: { username: string; email: string; password: string }) {
    const res = await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);
    tracker.trackUser(res.body.user.id);
    return { id: res.body.user.id as number, token: res.body.accessToken as string, email: res.body.user.email as string };
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({ where: { username: { startsWith: 'test_e2e_invites_' } } });
    await app.init();

    const creatorAuth = await registerAndLogin(creator);
    creatorToken = creatorAuth.token;

    const approverAuth = await registerAndLogin(approver);
    approverToken = approverAuth.token;

    const teamRes = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'E2E Invites Team', approverEmail: approver.email })
      .expect(201);
    teamId = teamRes.body.id;
    tracker.trackTeam(teamId);

    await request(app.getHttpServer())
      .post(`/teams/${teamId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  describe('personal invite for an unregistered email', () => {
    const invitee = { username: 'test_e2e_invites_newperson', email: 'test_e2e_invites_newperson@example.com', password: 'password123' };
    const wrongEmailUser = { username: 'test_e2e_invites_wrongemail', email: 'test_e2e_invites_wrongemail@example.com', password: 'password123' };
    let inviteToken: string;

    it('POST /teams/:id/members invites the unregistered email instead of 404ing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ username: invitee.email, role: 'DEVELOPER' })
        .expect(201);

      expect(res.body.email).toBe(invitee.email);
      expect(res.body.token).toBeTruthy();
      inviteToken = res.body.token;
    });

    it('rejects a duplicate invite to the same still-pending email', () => {
      return request(app.getHttpServer())
        .post(`/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ username: invitee.email, role: 'DEVELOPER' })
        .expect(409);
    });

    it('GET /invites/:token reports the invite as valid and locked to that email', () => {
      return request(app.getHttpServer())
        .get(`/invites/${inviteToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({ teamName: 'E2E Invites Team', email: invitee.email, valid: true });
        });
    });

    it('rejects consuming the invite with a different registered email', async () => {
      const wrongAuth = await registerAndLogin(wrongEmailUser);

      await request(app.getHttpServer())
        .post(`/invites/${inviteToken}/consume`)
        .set('Authorization', `Bearer ${wrongAuth.token}`)
        .expect(403);
    });

    it('registering with the invited email, then consuming, joins the team immediately (ACTIVE, no accept step)', async () => {
      const inviteeAuth = await registerAndLogin(invitee);

      const res = await request(app.getHttpServer())
        .post(`/invites/${inviteToken}/consume`)
        .set('Authorization', `Bearer ${inviteeAuth.token}`)
        .expect(201);

      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.userId).toBe(inviteeAuth.id);
    });

    it('rejects consuming the same personal invite a second time (single-use)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: invitee.username, password: invitee.password })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/invites/${inviteToken}/consume`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(409);
    });
  });

  describe('generic shareable invite link', () => {
    const joiner1 = { username: 'test_e2e_invites_joiner1', email: 'test_e2e_invites_joiner1@example.com', password: 'password123' };
    const joiner2 = { username: 'test_e2e_invites_joiner2', email: 'test_e2e_invites_joiner2@example.com', password: 'password123' };
    const joiner3 = { username: 'test_e2e_invites_joiner3', email: 'test_e2e_invites_joiner3@example.com', password: 'password123' };
    let linkToken: string;

    it('rejects link creation from a non-admin', async () => {
      const joinerAuth = await registerAndLogin(joiner3);
      await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${joinerAuth.token}`)
        .send({ maxUses: 2 })
        .expect(403);
    });

    it('admin creates a generic link with maxUses: 2 and no email', async () => {
      const res = await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ maxUses: 2 })
        .expect(201);

      expect(res.body.email).toBeNull();
      linkToken = res.body.token;
    });

    it('two different users can each join immediately via the same link', async () => {
      const auth1 = await registerAndLogin(joiner1);
      const res1 = await request(app.getHttpServer())
        .post(`/invites/${linkToken}/consume`)
        .set('Authorization', `Bearer ${auth1.token}`)
        .expect(201);
      expect(res1.body.status).toBe('ACTIVE');

      const auth2 = await registerAndLogin(joiner2);
      const res2 = await request(app.getHttpServer())
        .post(`/invites/${linkToken}/consume`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .expect(201);
      expect(res2.body.status).toBe('ACTIVE');
    });

    it('rejects a third join once maxUses is exhausted', async () => {
      const auth3 = await request(app.getHttpServer()).post('/auth/login').send({ username: joiner3.username, password: joiner3.password }).expect(200);

      await request(app.getHttpServer())
        .post(`/invites/${linkToken}/consume`)
        .set('Authorization', `Bearer ${auth3.body.accessToken}`)
        .expect(409);
    });

    it('GET /teams/:id/invites lists the link for the admin', () => {
      return request(app.getHttpServer())
        .get(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.some((i: any) => i.token === linkToken)).toBe(true);
        });
    });

    it('admin can revoke a link, after which it can no longer be consumed', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/teams/${teamId}/invites/${createRes.body.id}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ isRevoked: true })
        .expect(200);

      const infoRes = await request(app.getHttpServer()).get(`/invites/${createRes.body.token}`).expect(200);
      expect(infoRes.body).toMatchObject({ valid: false, reason: 'ההזמנה בוטלה' });
    });

    it('rejects creating a link with an already-past expiresAt', async () => {
      await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ expiresAt: '2000-01-01T00:00:00.000Z' })
        .expect(400);
    });

    it('a link that expires between creation and use is reported invalid and rejects consumption', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ expiresAt: new Date(Date.now() + 500).toISOString() })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 600));

      const infoRes = await request(app.getHttpServer()).get(`/invites/${createRes.body.token}`).expect(200);
      expect(infoRes.body).toMatchObject({ valid: false, reason: 'ההזמנה פגה' });

      await request(app.getHttpServer())
        .post(`/invites/${createRes.body.token}/consume`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(409);
    });
  });
});
