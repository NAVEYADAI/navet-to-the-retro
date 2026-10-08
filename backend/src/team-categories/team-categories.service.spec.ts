import { Test, TestingModule } from '@nestjs/testing';
import { TeamCategoriesService } from './team-categories.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('TeamCategoriesService', () => {
  let service: TeamCategoriesService;

  const team = { id: 10, name: 'Core Team' };
  const member = { userId: 1, teamId: team.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
  const admin = { userId: 2, teamId: team.id, isAdmin: true, role: 'DEVELOPER', status: 'ACTIVE' };
  const teamLeader = { userId: 3, teamId: team.id, isAdmin: false, role: 'TEAM_LEADER', status: 'ACTIVE' };

  const mockPrismaService = {
    team: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn() },
    teamCommentCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    comment: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamCategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TeamCategoriesService>(TeamCategoriesService);
    // Default: no comments at all, so existing tests that don't care about counts don't need to
    // mock this themselves — only the new commentCount-specific tests below override it.
    mockPrismaService.comment.groupBy.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.listCategories(team.id, member.userId, false)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester does not belong to the team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.listCategories(team.id, 999, false)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the requester is only a PENDING invitee (BUG-04)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, status: 'PENDING' });

      await expect(service.listCategories(team.id, member.userId, false)).rejects.toThrow(ForbiddenException);
    });

    it('allows a plain member to view the list (not admin-gated, unlike invites)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([]);

      await expect(service.listCategories(team.id, member.userId, false)).resolves.toEqual([]);
    });

    it('includes disabled categories by default (management panel view)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([]);

      await service.listCategories(team.id, member.userId, false);

      expect(mockPrismaService.teamCommentCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: team.id } })
      );
    });

    it('filters to isEnabled:true when enabledOnly is requested (comment-writing form view)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([]);

      await service.listCategories(team.id, member.userId, true);

      expect(mockPrismaService.teamCommentCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: team.id, isEnabled: true } })
      );
    });

    it('attaches each category\'s commentCount from the grouped comment counts', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([
        { id: 1, teamId: team.id, label: 'א' },
        { id: 2, teamId: team.id, label: 'ב' },
      ]);
      mockPrismaService.comment.groupBy.mockResolvedValue([
        { categoryId: 1, _count: { _all: 5 } },
      ]);

      const result = await service.listCategories(team.id, member.userId, false);

      expect(result).toEqual([
        { id: 1, teamId: team.id, label: 'א', commentCount: 5 },
        { id: 2, teamId: team.id, label: 'ב', commentCount: 0 },
      ]);
    });

    it('scopes the comment count to the given sprintIds (settings-panel filter)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([]);

      await service.listCategories(team.id, member.userId, false, [4, 5]);

      expect(mockPrismaService.comment.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: team.id, categoryId: { not: null }, sprintId: { in: [4, 5] } }),
        })
      );
    });

    it('does not filter by sprint when sprintIds is omitted', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.teamCommentCategory.findMany.mockResolvedValue([]);

      await service.listCategories(team.id, member.userId, false);

      const call = mockPrismaService.comment.groupBy.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('sprintId');
    });
  });

  describe('createCategory', () => {
    const dto = { label: 'קטגוריה מותאמת' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.createCategory(team.id, dto, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a plain member (not admin, not team leader)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await expect(service.createCategory(team.id, dto, member.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.teamCommentCategory.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an empty/whitespace-only label', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);

      await expect(service.createCategory(team.id, { label: '   ' }, admin.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamCommentCategory.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (not a TypeError/500) for a non-string or missing label (BUG-15)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);

      await expect(service.createCategory(team.id, { label: 5 as any }, admin.userId)).rejects.toThrow(BadRequestException);
      await expect(service.createCategory(team.id, { label: { a: 1 } as any }, admin.userId)).rejects.toThrow(BadRequestException);
      await expect(service.createCategory(team.id, undefined as any, admin.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamCommentCategory.create).not.toHaveBeenCalled();
    });

    it('allows a team admin to create a custom category', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamCommentCategory.create.mockResolvedValue({ id: 100, teamId: team.id, label: dto.label });

      await service.createCategory(team.id, dto, admin.userId);

      expect(mockPrismaService.teamCommentCategory.create).toHaveBeenCalledWith({
        data: { teamId: team.id, label: dto.label, isDefault: false, isEnabled: true, createdById: admin.userId },
      });
    });

    it('allows a team leader (non-admin) to create a custom category', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      mockPrismaService.teamCommentCategory.create.mockResolvedValue({ id: 101, teamId: team.id, label: dto.label });

      await expect(service.createCategory(team.id, dto, teamLeader.userId)).resolves.toBeDefined();
    });

    it('trims the label before saving', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamCommentCategory.create.mockResolvedValue({});

      await service.createCategory(team.id, { label: '  עם רווחים  ' }, admin.userId);

      expect(mockPrismaService.teamCommentCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ label: 'עם רווחים' }) })
      );
    });
  });

  describe('updateCategory', () => {
    const category = { id: 50, teamId: team.id, label: 'ברירת מחדל', isDefault: true, isEnabled: true };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.updateCategory(team.id, category.id, { isEnabled: false }, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a plain member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await expect(service.updateCategory(team.id, category.id, { isEnabled: false }, member.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.teamCommentCategory.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the category does not belong to this team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(null);

      await expect(service.updateCategory(team.id, 999, { isEnabled: false }, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('allows an admin to disable a default category (soft-disable, not delete — §3.0 decision #3)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(category);
      mockPrismaService.teamCommentCategory.update.mockResolvedValue({ ...category, isEnabled: false });

      await service.updateCategory(team.id, category.id, { isEnabled: false }, admin.userId);

      expect(mockPrismaService.teamCommentCategory.update).toHaveBeenCalledWith({
        where: { id: category.id },
        data: { isEnabled: false },
      });
    });

    it('throws BadRequestException when isEnabled is not a boolean (BUG-15)', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);

      await expect(service.updateCategory(team.id, category.id, { isEnabled: 'yes' as any }, admin.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.teamCommentCategory.update).not.toHaveBeenCalled();
    });

    it('allows a team leader (non-admin) to re-enable a category', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue({ ...category, isEnabled: false });
      mockPrismaService.teamCommentCategory.update.mockResolvedValue({ ...category, isEnabled: true });

      await expect(service.updateCategory(team.id, category.id, { isEnabled: true }, teamLeader.userId)).resolves.toBeDefined();
    });
  });
});
