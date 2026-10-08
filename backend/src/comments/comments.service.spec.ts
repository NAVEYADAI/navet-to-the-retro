import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('CommentsService', () => {
  let service: CommentsService;

  const sprint = { id: 1, teamId: 100 };
  const member = { userId: 10, teamId: sprint.teamId, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };
  const admin = { userId: 20, teamId: sprint.teamId, isAdmin: true, role: 'DEVELOPER', status: 'ACTIVE' };
  const teamLeader = { userId: 30, teamId: sprint.teamId, isAdmin: false, role: 'TEAM_LEADER', status: 'ACTIVE' };

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
    // Feature 3 (team comment categories): categoryId validation in create().
    teamCommentCategory: {
      findFirst: jest.fn(),
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

    // BUG-40: non-members get the same 404 as a non-existent sprint (no id enumeration).
    it('throws NotFoundException when the author is not a member of the sprint\'s team (BUG-40)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.create(sprint.id, createDto, 999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the author is only a PENDING invitee (BUG-04, BUG-40)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, status: 'PENDING' });

      await expect(service.create(sprint.id, { content: 'x', type: 'KEEP' } as any, member.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    // BUG-15: malformed bodies are 400s and never reach the DB.
    describe('input validation (BUG-15)', () => {
      const bad: [string, Record<string, unknown>][] = [
        ['missing content', { type: 'KEEP' }],
        ['empty content', { content: '', type: 'KEEP' }],
        ['whitespace-only content', { content: '   ', type: 'KEEP' }],
        ['non-string content', { content: 5, type: 'KEEP' }],
        ['missing type', { content: 'x' }],
        ['unknown type', { content: 'x', type: 'LOVE' }],
        ['string categoryId', { content: 'x', type: 'KEEP', categoryId: '3' }],
        ['fractional categoryId', { content: 'x', type: 'KEEP', categoryId: 1.5 }],
        ['over-Int32 categoryId', { content: 'x', type: 'KEEP', categoryId: 99999999999 }],
        ['string isAnonymous', { content: 'x', type: 'KEEP', isAnonymous: 'yes' }],
        ['string onBehalfOfUserId', { content: 'x', type: 'KEEP', onBehalfOfUserId: 'a' }],
      ];

      it.each(bad)('rejects %s with BadRequestException', async (_label, dto) => {
        await expect(service.create(sprint.id, dto as any, member.userId)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.sprint.findUnique).not.toHaveBeenCalled();
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('accepts IMPROVE, null categoryId and boolean isAnonymous', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

        await service.create(sprint.id, { content: 'x', type: 'IMPROVE', categoryId: null, isAnonymous: true } as any, member.userId);

        expect(mockPrismaService.comment.create).toHaveBeenCalled();
      });
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

    describe('categoryId (feature 3, team comment categories)', () => {
      const category = { id: 5, teamId: sprint.teamId, label: 'פלנינג', isEnabled: true };

      it('creates the comment with categoryId when the category belongs to the team and is enabled', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(category);
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

        await service.create(sprint.id, { ...createDto, categoryId: category.id }, member.userId);

        expect(mockPrismaService.teamCommentCategory.findFirst).toHaveBeenCalledWith({
          where: { id: category.id, teamId: sprint.teamId },
        });
        expect(mockPrismaService.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ categoryId: category.id }) })
        );
      });

      it('throws NotFoundException when the category does not belong to this team', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(null);

        await expect(service.create(sprint.id, { ...createDto, categoryId: 999 }, member.userId)).rejects.toThrow(NotFoundException);
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the category is disabled', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue({ ...category, isEnabled: false });

        await expect(service.create(sprint.id, { ...createDto, categoryId: category.id }, member.userId)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('skips category validation entirely when categoryId is omitted', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

        await service.create(sprint.id, createDto, member.userId);

        expect(mockPrismaService.teamCommentCategory.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('onBehalfOfUserId (feature 9, phantom members)', () => {
      const onBehalfDto = { ...createDto, onBehalfOfUserId: 77, isAnonymous: true };

      it('throws ForbiddenException when the requester is not admin/team-leader, even though they belong to the team', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValueOnce(member); // requester membership check

        await expect(service.create(sprint.id, onBehalfDto, member.userId)).rejects.toThrow(ForbiddenException);
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('throws NotFoundException when the target user is only a PENDING invitee (BUG-04)', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique
          .mockResolvedValueOnce(admin) // requester membership
          .mockResolvedValueOnce(admin) // assertCanManageTeamContent
          .mockResolvedValueOnce({ userId: 77, teamId: sprint.teamId, role: 'DEVELOPER', isAdmin: false, status: 'PENDING' });

        await expect(service.create(sprint.id, { content: 'x', type: 'KEEP', onBehalfOfUserId: 77 } as any, admin.userId)).rejects.toThrow(NotFoundException);
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('throws NotFoundException when the target user is not a member of this team', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique
          .mockResolvedValueOnce(admin) // requester membership check
          .mockResolvedValueOnce(admin) // assertCanManageTeamContent's own lookup
          .mockResolvedValueOnce(null); // target membership check

        await expect(service.create(sprint.id, onBehalfDto, admin.userId)).rejects.toThrow(NotFoundException);
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('sets authorId to the target, postedByAdminId to the requester, and forces isAnonymous:false server-side', async () => {
        const targetMembership = { userId: 77, teamId: sprint.teamId, role: 'DEVELOPER', isAdmin: false, status: 'ACTIVE' };
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique
          .mockResolvedValueOnce(admin) // requester membership check
          .mockResolvedValueOnce(admin) // assertCanManageTeamContent's own lookup
          .mockResolvedValueOnce(targetMembership); // target membership check
        mockPrismaService.comment.create.mockResolvedValue({ id: 2 });

        await service.create(sprint.id, onBehalfDto, admin.userId);

        expect(mockPrismaService.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              authorId: 77,
              postedByAdminId: admin.userId,
              isAnonymous: false,
            }),
          })
        );
      });

      it('allows a team leader (non-admin) to post on behalf of someone', async () => {
        const targetMembership = { userId: 77, teamId: sprint.teamId, role: 'DEVELOPER', isAdmin: false, status: 'ACTIVE' };
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique
          .mockResolvedValueOnce(teamLeader)
          .mockResolvedValueOnce(teamLeader)
          .mockResolvedValueOnce(targetMembership);
        mockPrismaService.comment.create.mockResolvedValue({ id: 3 });

        await expect(service.create(sprint.id, onBehalfDto, teamLeader.userId)).resolves.toBeDefined();
      });
    });
  });

  describe('getCommentsForSprint', () => {
    it('throws NotFoundException when the sprint does not exist', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(null);

      await expect(service.getCommentsForSprint(sprint.id, member.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException (same as a missing sprint) when the requester does not belong to the team (BUG-40)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.getCommentsForSprint(sprint.id, 999)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the requester is only a PENDING invitee (BUG-04, BUG-40)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, status: 'PENDING' });

      await expect(service.getCommentsForSprint(sprint.id, member.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.findMany).not.toHaveBeenCalled();
    });

    it('masks the author of anonymous comments so no one, not even admins, can unmask them', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { id: 1, content: 'named', isAnonymous: false, authorId: 5, author: { id: 5, username: 'nave' } },
        { id: 2, content: 'secret', isAnonymous: true, authorId: 6, author: { id: 6, username: 'liron' } },
      ]);

      const result = await service.getCommentsForSprint(sprint.id, admin.userId);

      expect(result[0].author).toEqual({ id: 5, username: 'nave' });
      expect(result[0]).toHaveProperty('authorId', 5);
      expect(result[1]).not.toHaveProperty('authorId'); // BUG-02
      expect(result[1].author).toEqual({ id: 0, username: 'Anonymous', firstName: 'Anonymous', lastName: '', isPhantom: false });
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

    // BUG-40: outsiders can't tell an existing comment id from a missing one.
    it('throws NotFoundException (not 403) when the requester is not an active member of the comment\'s team (BUG-40)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(comment);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.setHighlighted(comment.id, { isHighlighted: true }, 999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean isHighlighted with 400 (BUG-15)', async () => {
      await expect(service.setHighlighted(comment.id, { isHighlighted: 'yes' } as any, admin.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.comment.findUnique).not.toHaveBeenCalled();
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

    it('does not leak authorId when highlighting an anonymous comment (BUG-02)', async () => {
      const anon = { ...comment, isAnonymous: true, authorId: 6 };
      mockPrismaService.comment.findUnique.mockResolvedValue(anon);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.update.mockResolvedValue({ ...anon, isHighlighted: true });

      const result: any = await service.setHighlighted(comment.id, { isHighlighted: true }, admin.userId);

      expect(result).not.toHaveProperty('authorId');
      expect(result.author.username).toBe('Anonymous');
      expect(result.isHighlighted).toBe(true);
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
