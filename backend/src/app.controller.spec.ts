import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('BUG-42: does not leak the raw DB error message when the DB check fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED postgres://user:secret@db.internal:5432')
      );
      const result = await appController.getHello();
      expect(result).toContain('Database connection failed');
      expect(result).not.toContain('secret');
      expect(result).not.toContain('ECONNREFUSED');
    });

    it('should return successfully with database status', async () => {
      const result = await appController.getHello();
      expect(result).toContain('Hello World! Database connected successfully');
    });
  });
});
