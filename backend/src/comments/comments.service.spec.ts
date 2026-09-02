import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CommentsService', () => {
  let service: CommentsService;

  const sprint = { id: 1, teamId: 100 };
  const member = { userId: 10, teamId: sprint.teamId, isAdmin: false, role: 'DEVELOPER' };
  const admin = { userId: 20, teamId: sprint.teamId, isAdmin: true, role: 'DEVELOPER' };
  const teamLeader = { userId: 30, teamId: sprint.teamId, isAdmin: false, role: 'TEAM_LEADER' };

  const createDto = { content: 'Great sprint', type: 'KEEP' as const };

  const mockPrismaService = {
    sprint: {
      findUnique: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws NotFoundException when the sprint does not exist', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(null);

      await expect(service.create(sprint.id, createDto, member.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the author is not a member of the sprint\'s team', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.create(sprint.id, createDto, 999)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('creates the comment for a team member', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.create.mockResolvedValue({ id: 1, ...createDto });

      await service.create(sprint.id, createDto, member.userId);

      expect(mockPrismaService.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: createDto.content, teamId: sprint.teamId, sprintId: sprint.id, isAnonymous: false }),
        })
      );
    });
  });

  describe('getCommentsForSprint', () => {
    it('throws NotFoundException when the sprint does not exist', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(null);

      await expect(service.getCommentsForSprint(sprint.id, member.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester does not belong to the team', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.getCommentsForSprint(sprint.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('masks the author of anonymous comments so no one, not even admins, can unmask them', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { id: 1, content: 'named', isAnonymous: false, author: { id: 5, username: 'nave' } },
        { id: 2, content: 'secret', isAnonymous: true, author: { id: 6, username: 'liron' } },
      ]);

      const result = await service.getCommentsForSprint(sprint.id, admin.userId);

      expect(result[0].author).toEqual({ id: 5, username: 'nave' });
      expect(result[1].author).toEqual({ id: 0, username: 'Anonymous', firstName: 'Anonymous', lastName: '' });
    });
  });

  describe('setHighlighted', () => {
    const comment = { id: 1, teamId: sprint.teamId, isHighlighted: false };

    it('throws NotFoundException when the comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.setHighlighted(999, { isHighlighted: true }, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a plain team member (not admin, not team leader)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(comment);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await expect(service.setHighlighted(comment.id, { isHighlighted: true }, member.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('allows a team admin to highlight', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(comment);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.update.mockResolvedValue({ ...comment, isHighlighted: true });

      await service.setHighlighted(comment.id, { isHighlighted: true }, admin.userId);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: comment.id },
        data: { isHighlighted: true },
      });
    });

    it('allows a team leader (non-admin) to highlight', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(comment);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      mockPrismaService.comment.update.mockResolvedValue({ ...comment, isHighlighted: true });

      await expect(service.setHighlighted(comment.id, { isHighlighted: true }, teamLeader.userId)).resolves.toBeDefined();
    });

    it('allows unhighlighting the same way', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...comment, isHighlighted: true });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.update.mockResolvedValue({ ...comment, isHighlighted: false });

      await service.setHighlighted(comment.id, { isHighlighted: false }, admin.userId);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: comment.id },
        data: { isHighlighted: false },
      });
    });
  });
});
