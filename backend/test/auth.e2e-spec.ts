import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { assertTestDatabase } from './utils/require-test-db';
import { E2eCleanupTracker } from './utils/e2e-cleanup';

jest.setTimeout(30000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tracker = new E2eCleanupTracker();

  const testUser = {
    username: 'test_e2e_user',
    email: 'test_e2e@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'E2E',
  };

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Idempotency guard in case a previous run crashed before cleanup ran.
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'test_e2e_',
        },
      },
    });

    await app.init();
  });

  afterAll(async () => {
    await tracker.cleanupAll(prisma);
    await app.close();
  });

  describe('Registration & Login Flow', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          tracker.trackUser(res.body.user.id);
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user).toBeDefined();
          expect(res.body.user.username).toBe(testUser.username);
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.user.password).toBeUndefined(); // Password must be hidden
        });
    });

    it('should throw ConflictException on duplicate registration', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409); // Conflict
    });

    it('should login successfully and return access token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.username).toBe(testUser.username);
        });
    });

    it('should deny login with invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        })
        .expect(401); // Unauthorized
    });

    it('should fetch user profile with Bearer token', async () => {
      // 1. Login first to get token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const token = loginRes.body.accessToken;

      // 2. Fetch /auth/me with auth header
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.username).toBe(testUser.username);
          expect(res.body.email).toBe(testUser.email);
        });
    });

    it('should reject /auth/me with no Authorization header', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject /auth/me with a garbage Bearer token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid token');
        });
    });

    it('should update the profile with a valid Bearer token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password });
      const token = loginRes.body.accessToken;

      return request(app.getHttpServer())
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated', lastName: 'Name' })
        .expect(200)
        .expect((res) => {
          expect(res.body.firstName).toBe('Updated');
          expect(res.body.lastName).toBe('Name');
        });
    });

    it('should reject a profile update with no Authorization header', () => {
      return request(app.getHttpServer())
        .patch('/auth/profile')
        .send({ firstName: 'Nope' })
        .expect(401);
    });
  });
});
