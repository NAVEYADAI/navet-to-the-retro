import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(30000);

describe('TeamsController (e2e) — dual-approval flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  // The approver allowlist in teams.service.ts is hardcoded to these two real addresses —
  // safe to register here only because this suite runs against the isolated test database.
  const creator = { username: 'test_e2e_teams_creator', email: 'test_e2e_teams_creator@example.com', password: 'password123' };
  const approver = { username: 'test_e2e_teams_approver', email: 'naveyadai@gmail.com', password: 'password123', firstName: 'Nave', lastName: 'Yadai' };
  const selfApprover = { username: 'test_e2e_teams_selfapprove', email: 'lironka13@gmail.com', password: 'password123' };
  const outsider = { username: 'test_e2e_teams_outsider', email: 'test_e2e_teams_outsider@example.com', password: 'password123' };

  let creatorToken: string;
  let creatorId: number;
  let approverToken: string;
  let approverId: number;

  async function registerAndLogin(user: { username: string; email: string; password: string; firstName?: string; lastName?: string }) {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);
    tracker.trackUser(registerRes.body.user.id);
    return { id: registerRes.body.user.id as number, token: registerRes.body.accessToken as string };
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await prisma.user.deleteMany({ where: { username: { startsWith: 'test_e2e_teams_' } } });

    await app.init();

    const creatorAuth = await registerAndLogin(creator);
    creatorId = creatorAuth.id;
    creatorToken = creatorAuth.token;

    const approverAuth = await registerAndLogin(approver);
    approverId = approverAuth.id;
    approverToken = approverAuth.token;
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  it('rejects a non-allowlisted approver email', () => {
    return request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Team Forbidden', approverEmail: 'random@example.com' })
      .expect(403);
  });

  it('rejects an allowlisted but not-yet-registered approver email', () => {
    // lironka13@gmail.com is allowlisted but nobody has registered with it yet.
    return request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Team NotFound', approverEmail: 'lironka13@gmail.com' })
      .expect(404);
  });

  let teamAId: number;

  it('creates a team as PENDING_APPROVAL with the creator auto-added as TEAM_LEADER admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Team A', mainOffice: 'Haifa', approverEmail: approver.email })
      .expect(201);

    teamAId = res.body.id;
    tracker.trackTeam(teamAId);

    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.pendingApproverId).toBe(approverId);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0]).toMatchObject({ userId: creatorId, role: 'TEAM_LEADER', isAdmin: true });
  });

  it('rejects adding a member to a team that is still PENDING_APPROVAL', () => {
    return request(app.getHttpServer())
      .post(`/teams/${teamAId}/members`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ username: outsider.username, role: 'DEVELOPER' })
      .expect(409);
  });

  it('rejects creating a sprint for a team that is still PENDING_APPROVAL', () => {
    return request(app.getHttpServer())
      .post(`/teams/${teamAId}/sprints`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14' })
      .expect(409);
  });

  it('lists both allowed approvers, with the registered one\'s displayName populated', async () => {
    const res = await request(app.getHttpServer())
      .get('/teams/allowed-approvers')
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: approver.email, displayName: 'Nave Yadai' }),
        expect.objectContaining({ email: 'lironka13@gmail.com' }),
      ])
    );
  });

  it('reflects the pending team for both creator and approver in GET /teams/user/me', async () => {
    const asCreator = await request(app.getHttpServer())
      .get('/teams/user/me')
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(200);
    expect(asCreator.body.find((t: any) => t.id === teamAId)).toMatchObject({ status: 'PENDING_APPROVAL' });

    const asApprover = await request(app.getHttpServer())
      .get('/teams/user/me')
      .set('Authorization', `Bearer ${approverToken}`)
      .expect(200);
    expect(asApprover.body.find((t: any) => t.id === teamAId)).toMatchObject({ status: 'PENDING_APPROVAL', roleInTeam: null });
  });

  it('rejects approval by someone other than the designated approver', () => {
    return request(app.getHttpServer())
      .post(`/teams/${teamAId}/approve`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .expect(403);
  });

  it('approves the team: activates it without adding the approver as a member', async () => {
    const res = await request(app.getHttpServer())
      .post(`/teams/${teamAId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .expect(201);

    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.pendingApproverId).toBeNull();
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: creatorId, role: 'TEAM_LEADER', isAdmin: true }),
      ])
    );
    expect(res.body.members.some((m: any) => m.userId === approverId)).toBe(false);
  });

  it('rejects approving an already-active team', () => {
    return request(app.getHttpServer())
      .post(`/teams/${teamAId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .expect(409);
  });

  it('rejects self-approval when the creator\'s own email is the designated approver', async () => {
    const selfApproverAuth = await registerAndLogin(selfApprover);

    await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${selfApproverAuth.token}`)
      .send({ name: 'Team SelfApprove', approverEmail: selfApprover.email })
      .expect(409);
  });

  describe('decline flow', () => {
    let teamBId: number;
    let teamCId: number;
    let outsiderToken: string;

    beforeAll(async () => {
      const outsiderAuth = await registerAndLogin(outsider);
      outsiderToken = outsiderAuth.token;

      const teamBRes = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ name: 'Team B', approverEmail: approver.email })
        .expect(201);
      teamBId = teamBRes.body.id;
      tracker.trackTeam(teamBId);

      const teamCRes = await request(app.getHttpServer())
        .post('/teams')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ name: 'Team C', approverEmail: approver.email })
        .expect(201);
      teamCId = teamCRes.body.id;
      tracker.trackTeam(teamCId);
    });

    it('rejects decline by an unrelated user', () => {
      return request(app.getHttpServer())
        .post(`/teams/${teamBId}/decline`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('lets the creator decline a pending team, deleting it', async () => {
      await request(app.getHttpServer())
        .post(`/teams/${teamBId}/decline`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ success: true });
        });

      // Team is genuinely gone — a follow-up action against it 404s.
      await request(app.getHttpServer())
        .post(`/teams/${teamBId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(404);
    });

    it('lets the approver decline a pending team, deleting it', async () => {
      await request(app.getHttpServer())
        .post(`/teams/${teamCId}/decline`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });
  });

  describe('member invite flow', () => {
    // teamAId is ACTIVE by this point (approved earlier in the top-level describe), with
    // creatorToken/creatorId as its sole admin member.
    const invitee = { username: 'test_e2e_teams_invitee', email: 'test_e2e_teams_invitee@example.com', password: 'password123' };
    let inviteeToken: string;
    let inviteeId: number;
    let inviteId: number;

    beforeAll(async () => {
      const inviteeAuth = await registerAndLogin(invitee);
      inviteeId = inviteeAuth.id;
      inviteeToken = inviteeAuth.token;
    });

    it('creates a PENDING invite rather than an active membership', async () => {
      const res = await request(app.getHttpServer())
        .post(`/teams/${teamAId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ username: invitee.username, role: 'DEVELOPER' })
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(res.body.userId).toBe(inviteeId);
      inviteId = res.body.id;

      const membersRes = await request(app.getHttpServer())
        .get(`/teams/${teamAId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);
      expect(membersRes.body.find((m: any) => m.id === inviteId)).toMatchObject({ status: 'PENDING' });
    });

    it('rejects accept/decline by anyone other than the invitee or an admin', async () => {
      await request(app.getHttpServer())
        .post(`/teams/${teamAId}/members/${inviteId}/accept`)
        .set('Authorization', `Bearer ${approverToken}`)
        .expect(403);
    });

    it('rejects a second invite while one is already pending', () => {
      return request(app.getHttpServer())
        .post(`/teams/${teamAId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ username: invitee.username, role: 'DEVELOPER' })
        .expect(409);
    });

    it('lets the invitee accept: activates the membership', async () => {
      const res = await request(app.getHttpServer())
        .post(`/teams/${teamAId}/members/${inviteId}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`)
        .expect(201);

      expect(res.body.status).toBe('ACTIVE');
    });

    it('rejects accepting an already-accepted invite', () => {
      return request(app.getHttpServer())
        .post(`/teams/${teamAId}/members/${inviteId}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`)
        .expect(409);
    });

    it('lets a team admin cancel a still-pending invite (decline)', async () => {
      const inviteRes = await request(app.getHttpServer())
        .post(`/teams/${teamAId}/members`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({ username: outsider.username, role: 'DEVELOPER' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/teams/${teamAId}/members/${inviteRes.body.id}/decline`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({ success: true });
        });
    });

    describe('remove member flow', () => {
      // `invitee` is now an ACTIVE, non-admin member of teamAId (accepted above).
      it('rejects removal by a non-admin', () => {
        return request(app.getHttpServer())
          .delete(`/teams/${teamAId}/members/${inviteId}`)
          .set('Authorization', `Bearer ${inviteeToken}`)
          .expect(403);
      });

      it('rejects removing the only admin', () => {
        return request(app.getHttpServer())
          .get(`/teams/${teamAId}/members`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .then((res) => {
            const creatorMemberId = res.body.find((m: any) => m.userId === creatorId).id;
            return request(app.getHttpServer())
              .delete(`/teams/${teamAId}/members/${creatorMemberId}`)
              .set('Authorization', `Bearer ${creatorToken}`)
              .expect(409);
          });
      });

      it('lets an admin remove a regular member', async () => {
        await request(app.getHttpServer())
          .delete(`/teams/${teamAId}/members/${inviteId}`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({ success: true });
          });

        const membersRes = await request(app.getHttpServer())
          .get(`/teams/${teamAId}/members`)
          .set('Authorization', `Bearer ${creatorToken}`)
          .expect(200);
        expect(membersRes.body.find((m: any) => m.id === inviteId)).toBeUndefined();
      });
    });
  });
});
