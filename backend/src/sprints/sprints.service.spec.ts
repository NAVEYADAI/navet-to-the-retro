import { Test, TestingModule } from '@nestjs/testing';
import { SprintsService } from './sprints.service';
import { PrismaService } from '../prisma.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('SprintsService', () => {
  let service: SprintsService;

  const activeTeam = { id: 1, status: 'ACTIVE' };
  const pendingTeam = { id: 2, status: 'PENDING_APPROVAL' };
  const admin = { userId: 10, teamId: activeTeam.id, isAdmin: true };
  const nonAdmin = { userId: 20, teamId: activeTeam.id, isAdmin: false };

  const dto = { name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14' };

  const mockPrismaService = {
    team: {
      findUnique: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
    },
    sprint: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SprintsService>(SprintsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.create(activeTeam.id, dto, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the team is not yet ACTIVE', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(pendingTeam);

      await expect(service.create(pendingTeam.id, dto, admin.userId)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.teamMember.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.sprint.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is not a team admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.create(activeTeam.id, dto, nonAdmin.userId)).rejects.toThrow(ForbiddenException);
    });

    it('creates the sprint for an admin on an ACTIVE team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.create.mockResolvedValue({ id: 1, ...dto, teamId: activeTeam.id });

      await service.create(activeTeam.id, dto, admin.userId);

      expect(mockPrismaService.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teamId: activeTeam.id, name: dto.name }) })
      );
    });
  });

  describe('findAll', () => {
    it('throws ForbiddenException when the requester does not belong to the team', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.findAll(activeTeam.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('returns sprints for a team member', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);
      mockPrismaService.sprint.findMany.mockResolvedValue([{ id: 1, name: 'Sprint 1' }]);

      const result = await service.findAll(activeTeam.id, nonAdmin.userId);

      expect(result).toEqual([{ id: 1, name: 'Sprint 1' }]);
    });
  });
});
