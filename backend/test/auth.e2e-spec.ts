import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    username: 'test_e2e_user',
    email: 'test_e2e@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'E2E',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    // Clean before tests start
    await prisma.user.deleteMany({
      where: {
        username: testUser.username
      }
    });

    await app.init();
  });

  afterAll(async () => {
    // Clean up created users after tests
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'test_e2e_'
        }
      }
    });
    await app.close();
  });

  describe('Registration & Login Flow', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.username).toBe(testUser.username);
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.password).toBeUndefined(); // Password must be hidden
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
  });
});
