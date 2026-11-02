import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SprintLockedException } from '../sprints/sprint-write-window.util';

// Sprint dates are midnight UTC of a calendar day; `endDate` N days ago puts the sprint N days past its end.
const dayOffset = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

describe('CommentsService', () => {
  let service: CommentsService;

  const sprint = { id: 1, teamId: 100, startDate: dayOffset(-5), endDate: dayOffset(5) };
  // Ended 10 days ago: past the 3-day write window.
  const lockedSprint = { ...sprint, startDate: dayOffset(-20), endDate: dayOffset(-10) };
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
      findMany: jest.fn().mockResolvedValue([]),
    },
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // Feature 13: write extensions (only queried once the board is locked).
    sprintWriteExtension: {
      findFirst: jest.fn(),
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
    jest.resetAllMocks();
    mockPrismaService.teamMember.findMany.mockResolvedValue([]);
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

      it('rejects content longer than 2000 characters on create (400, Hebrew message), accepts exactly 2000', async () => {
        const err = await service.create(sprint.id, { content: 'x'.repeat(2001), type: 'KEEP' }, member.userId).catch(e => e);
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toBe('ההערה ארוכה מדי (עד 2000 תווים)');
        expect(mockPrismaService.sprint.findUnique).not.toHaveBeenCalled();

        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });
        await expect(service.create(sprint.id, { content: 'x'.repeat(2000), type: 'KEEP' }, member.userId)).resolves.toBeDefined();
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

    // Feature 11 §11.0 decision #4
    it('flags whether each named comment\'s author is still an ACTIVE member, but never on masked ones', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.teamMember.findMany.mockResolvedValueOnce([{ userId: 5 }]);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { id: 1, content: 'still here', isAnonymous: false, authorId: 5, author: { id: 5 } },
        { id: 2, content: 'left the team', isAnonymous: false, authorId: 7, author: { id: 7 } },
        { id: 3, content: 'secret', isAnonymous: true, authorId: 7, author: { id: 7 } },
      ]);

      const result = await service.getCommentsForSprint(sprint.id, admin.userId);

      expect(mockPrismaService.teamMember.findMany).toHaveBeenCalledWith({
        where: { teamId: sprint.teamId, status: 'ACTIVE' },
        select: { userId: true },
      });
      expect(result[0]).toHaveProperty('authorIsActiveMember', true);
      expect(result[1]).toHaveProperty('authorIsActiveMember', false);
      expect(result[2]).not.toHaveProperty('authorIsActiveMember');
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
  describe('soft-deleted sprints and teams (feature 14)', () => {
    const liveSprint = { ...sprint, deletedAt: null, team: { deletedAt: null } };
    const deletedSprint = { ...sprint, deletedAt: new Date(), team: { deletedAt: null } };
    const sprintOfDeletedTeam = { ...sprint, deletedAt: null, team: { deletedAt: new Date() } };

    it.each([
      ['a soft-deleted sprint', deletedSprint],
      ['a sprint of a soft-deleted team', sprintOfDeletedTeam],
    ])('create 404s for %s, even for an active member', async (_label, row) => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(row);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      await expect(service.create(sprint.id, createDto, member.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a soft-deleted sprint', deletedSprint],
      ['a sprint of a soft-deleted team', sprintOfDeletedTeam],
    ])('getCommentsForSprint 404s for %s — its comments are hidden until it is restored', async (_label, row) => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(row);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      await expect(service.getCommentsForSprint(sprint.id, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.findMany).not.toHaveBeenCalled();
    });

    it('a restored sprint (deletedAt back to null) serves its comments again', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(liveSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([]);
      await expect(service.getCommentsForSprint(sprint.id, admin.userId)).resolves.toEqual([]);
    });

    it('the lookup also loads the team, so a deleted team is noticed', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(liveSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([]);
      await service.getCommentsForSprint(sprint.id, admin.userId);
      expect(mockPrismaService.sprint.findUnique).toHaveBeenCalledWith({
        where: { id: sprint.id },
        include: { team: { select: { deletedAt: true } } },
      });
    });

    it.each([
      ['a soft-deleted sprint', { id: 1, teamId: sprint.teamId, sprint: { deletedAt: new Date(), team: { deletedAt: null } } }],
      ['a sprint of a soft-deleted team', { id: 1, teamId: sprint.teamId, sprint: { deletedAt: null, team: { deletedAt: new Date() } } }],
    ])('highlighting a comment of %s is 404', async (_label, comment) => {
      mockPrismaService.comment.findUnique.mockResolvedValue(comment);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      await expect(service.setHighlighted(1, { isHighlighted: true }, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });
  });

  // ---- Feature 13 (product-backlog/13-comment-edit-delete.md) ----
  describe('feature 13 — write window on create', () => {
    it('rejects a comment on a sprint that ended more than 3 days ago (403, Hebrew message)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);

      const err = await service.create(sprint.id, createDto, member.userId).catch(e => e);
      expect(err).toBeInstanceOf(SprintLockedException);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.message).toBe('הלוח נעול לכתיבה — הספרינט הסתיים');
      expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
    });

    it('allows it on a locked sprint when the user has an active extension', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ userId: member.userId, expiresAt: dayOffset(2) });
      mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

      await expect(service.create(sprint.id, createDto, member.userId)).resolves.toBeDefined();
      expect(mockPrismaService.sprintWriteExtension.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sprintId: sprint.id, userId: member.userId, expiresAt: { gt: expect.any(Date) } }) })
      );
    });

    it('an expired extension is filtered out by the query (expiresAt > now) and the write is refused', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null); // expired -> not returned

      await expect(service.create(sprint.id, createDto, member.userId)).rejects.toThrow(SprintLockedException);
    });

    it('does not even look for extensions inside the window', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

      await service.create(sprint.id, createDto, member.userId);
      expect(mockPrismaService.sprintWriteExtension.findFirst).not.toHaveBeenCalled();
    });

    describe('anonymous comments once the board is locked (security: timestamps would identify the writer)', () => {
      const anonDto = { ...createDto, isAnonymous: true };

      it('rejects isAnonymous:true when writing relies on an extension (403, Hebrew message)', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ userId: member.userId, expiresAt: dayOffset(2) });

        const err = await service.create(sprint.id, anonDto, member.userId).catch(e => e);
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(err.message).toBe('אי אפשר לפרסם הערה אנונימית אחרי שהלוח ננעל — מועד הפרסום היה חושף מי כתב אותה');
        expect(mockPrismaService.comment.create).not.toHaveBeenCalled();
      });

      it('still allows a NAMED comment through the extension', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ userId: member.userId, expiresAt: dayOffset(2) });
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

        await expect(service.create(sprint.id, { ...createDto, isAnonymous: false }, member.userId)).resolves.toBeDefined();
      });

      it('allows an anonymous comment inside the normal window', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

        await service.create(sprint.id, anonDto, member.userId);
        expect(mockPrismaService.comment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ isAnonymous: true }) })
        );
      });

      it('on a locked sprint without an extension the lock error comes first, not the anonymity one', async () => {
        mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);

        await expect(service.create(sprint.id, anonDto, member.userId)).rejects.toThrow(SprintLockedException);
      });
    });

    it('marks the created comment as the creator\'s own and editable', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.create.mockResolvedValue({ id: 1 });

      const result: any = await service.create(sprint.id, createDto, member.userId);
      expect(result).toMatchObject({ isMine: true, canEdit: true, canDelete: true });
    });
  });

  describe('feature 13 — getCommentsForSprint: deleted filter and isMine/canEdit', () => {
    const rows = [
      { id: 1, content: 'mine named', isAnonymous: false, authorId: member.userId, postedByAdminId: null, author: { id: member.userId } },
      { id: 2, content: 'mine anon', isAnonymous: true, authorId: member.userId, postedByAdminId: null, author: { id: member.userId, username: 'me' } },
      { id: 3, content: 'theirs anon', isAnonymous: true, authorId: 6, postedByAdminId: null, author: { id: 6, username: 'liron' } },
      { id: 4, content: 'posted in my name by an admin', isAnonymous: false, authorId: member.userId, postedByAdminId: admin.userId, author: { id: member.userId } },
      { id: 5, content: 'theirs', isAnonymous: false, authorId: 6, postedByAdminId: null, author: { id: 6 } },
    ];

    it('queries only comments that are not soft-deleted', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.findMany.mockResolvedValue([]);

      await service.getCommentsForSprint(sprint.id, member.userId);

      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sprintId: sprint.id, deletedAt: null } })
      );
    });

    it('flags the requester\'s own comments (including an anonymous one) without leaking authorId (BUG-02)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.findMany.mockResolvedValue(rows);

      const result: any[] = await service.getCommentsForSprint(sprint.id, member.userId);
      const byId = Object.fromEntries(result.map(r => [r.id, r]));

      expect(byId[1]).toMatchObject({ isMine: true, canEdit: true, canDelete: true });
      expect(byId[2]).toMatchObject({ isMine: true, canEdit: true, canDelete: true });
      expect(byId[2]).not.toHaveProperty('authorId');
      expect(byId[2].author.username).toBe('Anonymous');
      expect(byId[3]).toMatchObject({ isMine: false, canEdit: false, canDelete: false });
      expect(byId[3]).not.toHaveProperty('authorId');
      expect(byId[4]).toMatchObject({ isMine: true, canEdit: true }); // "in whose name" side
      expect(byId[5]).toMatchObject({ isMine: false, canEdit: false });
      // the flags must not differ between two anonymous comments in any way other than isMine/canEdit/canDelete
      expect(Object.keys(byId[2]).sort()).toEqual(Object.keys(byId[3]).sort());
    });

    it('the poster (postedByAdminId) sees the comment as theirs', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue(rows);

      const result: any[] = await service.getCommentsForSprint(sprint.id, admin.userId);
      expect(result.find(r => r.id === 4)).toMatchObject({ isMine: true, canEdit: true });
    });

    it('on a locked sprint nothing is editable, but an admin may still delete (moderation)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);
      mockPrismaService.comment.findMany.mockResolvedValue(rows);

      const result: any[] = await service.getCommentsForSprint(sprint.id, admin.userId);
      expect(result.every(r => r.canEdit === false)).toBe(true);
      expect(result.every(r => r.canDelete === true)).toBe(true);
    });

    it('a plain member on a locked sprint cannot edit or delete even their own comment', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);
      mockPrismaService.comment.findMany.mockResolvedValue(rows);

      const result: any[] = await service.getCommentsForSprint(sprint.id, member.userId);
      expect(result.find(r => r.id === 1)).toMatchObject({ isMine: true, canEdit: false, canDelete: false });
    });

    it('with an active extension the member can edit their own comments on a locked sprint', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(lockedSprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt: dayOffset(1) });
      mockPrismaService.comment.findMany.mockResolvedValue(rows);

      const result: any[] = await service.getCommentsForSprint(sprint.id, member.userId);
      expect(result.find(r => r.id === 1)).toMatchObject({ canEdit: true, canDelete: true });
      expect(result.find(r => r.id === 5)).toMatchObject({ canEdit: false, canDelete: false });
    });
  });

  describe('feature 13 — update', () => {
    const own = {
      id: 50, teamId: sprint.teamId, sprintId: sprint.id, authorId: member.userId, postedByAdminId: null,
      content: 'old', type: 'KEEP', categoryId: null, isAnonymous: false, isHighlighted: true, deletedAt: null,
      sprint: { id: sprint.id, endDate: sprint.endDate, deletedAt: null, team: { deletedAt: null } },
    };
    const lockedOwn = { ...own, sprint: { ...own.sprint, endDate: lockedSprint.endDate } };

    beforeEach(() => {
      mockPrismaService.comment.update.mockImplementation(async ({ data }: any) => ({
        ...own, ...data, author: { id: own.authorId, username: 'me' }, postedByAdmin: null, category: null,
      }));
    });

    it('the writer edits the content, stamping updatedAt and keeping the highlight', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      const result: any = await service.update(own.id, { content: 'new' }, member.userId);

      const call = mockPrismaService.comment.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: own.id });
      expect(call.data.content).toBe('new');
      expect(call.data.updatedAt).toBeInstanceOf(Date);
      expect(call.data).not.toHaveProperty('isHighlighted');
      expect(call.data).not.toHaveProperty('isAnonymous');
      expect(result.isHighlighted).toBe(true);
    });

    it('moves the comment to the other column', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await service.update(own.id, { type: 'IMPROVE' }, member.userId);

      expect(mockPrismaService.comment.update.mock.calls[0][0].data).toMatchObject({ type: 'IMPROVE' });
    });

    it('does not stamp updatedAt when nothing actually changes', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await service.update(own.id, { content: 'old', type: 'KEEP', categoryId: null }, member.userId);

      expect(mockPrismaService.comment.update.mock.calls[0][0].data).toEqual({});
    });

    it('someone else cannot edit it (403)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, userId: 99 });

      await expect(service.update(own.id, { content: 'x' }, 99)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('not even an admin or team leader can rewrite someone else\'s comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      await expect(service.update(own.id, { content: 'x' }, admin.userId)).rejects.toThrow(ForbiddenException);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      await expect(service.update(own.id, { content: 'x' }, teamLeader.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('the admin who posted it in someone\'s name may edit it', async () => {
      const onBehalf = { ...own, authorId: 77, postedByAdminId: admin.userId };
      mockPrismaService.comment.findUnique.mockResolvedValue(onBehalf);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);

      await expect(service.update(own.id, { content: 'fixed' }, admin.userId)).resolves.toBeDefined();
    });

    it('the person it was posted for (authorId) may edit it too', async () => {
      const onBehalf = { ...own, authorId: member.userId, postedByAdminId: admin.userId };
      mockPrismaService.comment.findUnique.mockResolvedValue(onBehalf);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await expect(service.update(own.id, { content: 'fixed' }, member.userId)).resolves.toBeDefined();
    });

    it('editing my anonymous comment works and does not leak authorId (BUG-02)', async () => {
      const anon = { ...own, isAnonymous: true };
      mockPrismaService.comment.findUnique.mockResolvedValue(anon);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.update.mockResolvedValue({ ...anon, content: 'new', author: { id: member.userId, username: 'me' }, postedByAdmin: null, category: null });

      const result: any = await service.update(own.id, { content: 'new' }, member.userId);

      expect(result).not.toHaveProperty('authorId');
      expect(result.author.username).toBe('Anonymous');
      expect(result).toMatchObject({ isMine: true, canEdit: true, content: 'new' });
    });

    it('rejects changing isAnonymous (400), either way, before touching the DB', async () => {
      await expect(service.update(own.id, { isAnonymous: false } as any, member.userId)).rejects.toThrow(BadRequestException);
      await expect(service.update(own.id, { content: 'x', isAnonymous: true } as any, member.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.comment.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty body', {}],
      ['blank content', { content: '  ' }],
      ['non-string content', { content: 5 }],
      ['unknown type', { type: 'LOVE' }],
      ['null type', { type: null }],
      ['string categoryId', { categoryId: '3' }],
    ])('rejects %s with 400', async (_l, dto) => {
      await expect(service.update(own.id, dto as any, member.userId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.comment.findUnique).not.toHaveBeenCalled();
    });

    it('rejects content longer than 2000 characters (400) before touching the DB', async () => {
      const err = await service.update(own.id, { content: 'x'.repeat(2001) }, member.userId).catch(e => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('ההערה ארוכה מדי (עד 2000 תווים)');
      expect(mockPrismaService.comment.findUnique).not.toHaveBeenCalled();
    });

    it('PATCH can never change anonymity, even on a locked sprint with an extension (400)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(lockedOwn);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ userId: member.userId, expiresAt: dayOffset(2) });
      await expect(service.update(own.id, { content: 'x', isAnonymous: true } as any, member.userId)).rejects.toThrow('לא ניתן לשנות אנונימיות של הערה קיימת');
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('outside the write window it is locked (403)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(lockedOwn);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);

      await expect(service.update(own.id, { content: 'x' }, member.userId)).rejects.toThrow(SprintLockedException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('with an active extension it is allowed on a locked sprint', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(lockedOwn);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt: dayOffset(1) });

      await expect(service.update(own.id, { content: 'x' }, member.userId)).resolves.toBeDefined();
    });

    it('an expired extension does not help (query returns nothing)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(lockedOwn);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);

      await expect(service.update(own.id, { type: 'IMPROVE' }, member.userId)).rejects.toThrow(ForbiddenException);
    });

    it('404 for a missing, soft-deleted, or other-team comment (BUG-40)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);
      await expect(service.update(1, { content: 'x' }, member.userId)).rejects.toThrow(NotFoundException);

      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, deletedAt: new Date() });
      await expect(service.update(own.id, { content: 'x' }, member.userId)).rejects.toThrow(NotFoundException);

      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.update(own.id, { content: 'x' }, 999)).rejects.toThrow(NotFoundException);

      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, status: 'REMOVED' });
      await expect(service.update(own.id, { content: 'x' }, member.userId)).rejects.toThrow(NotFoundException);
    });

    it('404 when the sprint or its team is soft-deleted', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, sprint: { ...own.sprint, deletedAt: new Date() } });
      await expect(service.update(own.id, { content: 'x' }, member.userId)).rejects.toThrow(NotFoundException);
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, sprint: { ...own.sprint, team: { deletedAt: new Date() } } });
      await expect(service.update(own.id, { content: 'x' }, member.userId)).rejects.toThrow(NotFoundException);
    });

    describe('category', () => {
      const category = { id: 5, teamId: sprint.teamId, label: 'x', isEnabled: true };

      it('moves to an enabled category of the same team', async () => {
        mockPrismaService.comment.findUnique.mockResolvedValue(own);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(category);

        await service.update(own.id, { categoryId: 5 }, member.userId);

        expect(mockPrismaService.teamCommentCategory.findFirst).toHaveBeenCalledWith({ where: { id: 5, teamId: sprint.teamId } });
        expect(mockPrismaService.comment.update.mock.calls[0][0].data).toMatchObject({ categoryId: 5 });
      });

      it('404 for a category of another team, 400 for a disabled one', async () => {
        mockPrismaService.comment.findUnique.mockResolvedValue(own);
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue(null);
        await expect(service.update(own.id, { categoryId: 9 }, member.userId)).rejects.toThrow(NotFoundException);
        mockPrismaService.teamCommentCategory.findFirst.mockResolvedValue({ ...category, isEnabled: false });
        await expect(service.update(own.id, { categoryId: 5 }, member.userId)).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
      });

      it('null clears the category without validation', async () => {
        mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, categoryId: 5 });
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

        await service.update(own.id, { categoryId: null }, member.userId);

        expect(mockPrismaService.teamCommentCategory.findFirst).not.toHaveBeenCalled();
        expect(mockPrismaService.comment.update.mock.calls[0][0].data).toMatchObject({ categoryId: null });
      });

      it('keeping the current (since disabled) category is not re-validated', async () => {
        mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, categoryId: 5 });
        mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

        await service.update(own.id, { content: 'new', categoryId: 5 }, member.userId);

        expect(mockPrismaService.teamCommentCategory.findFirst).not.toHaveBeenCalled();
      });
    });
  });

  describe('feature 13 — remove (soft delete)', () => {
    const own = {
      id: 60, teamId: sprint.teamId, sprintId: sprint.id, authorId: member.userId, postedByAdminId: null,
      isAnonymous: false, deletedAt: null,
      sprint: { id: sprint.id, endDate: sprint.endDate, deletedAt: null, team: { deletedAt: null } },
    };
    const lockedOwn = { ...own, sprint: { ...own.sprint, endDate: lockedSprint.endDate } };
    const othersOld = { ...lockedOwn, authorId: 6 };

    it('the writer deletes their comment: soft delete with deletedAt + deletedById', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.comment.update.mockResolvedValue({});

      await service.remove(own.id, member.userId);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: own.id },
        data: { deletedAt: expect.any(Date), deletedById: member.userId },
      });
    });

    it('the poster-in-name may delete it too', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, authorId: 77, postedByAdminId: teamLeader.userId });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      mockPrismaService.comment.update.mockResolvedValue({});

      await expect(service.remove(own.id, teamLeader.userId)).resolves.toBeDefined();
    });

    it('someone else (plain member) cannot delete it', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);

      await expect(service.remove(own.id, 99)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('a team leader (non-admin) cannot delete someone else\'s comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);

      await expect(service.remove(own.id, teamLeader.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });

    it('an admin deletes someone else\'s comment from an old, locked sprint (moderation ignores the window)', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(othersOld);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.update.mockResolvedValue({});

      await service.remove(othersOld.id, admin.userId);

      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: othersOld.id },
        data: { deletedAt: expect.any(Date), deletedById: admin.userId },
      });
    });

    it('an admin may delete their own comment on a locked sprint too', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...lockedOwn, authorId: admin.userId });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.update.mockResolvedValue({});

      await expect(service.remove(own.id, admin.userId)).resolves.toBeDefined();
    });

    it('the writer cannot delete their own comment once the board is locked; an extension reopens it', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(lockedOwn);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue(null);
      await expect(service.remove(own.id, member.userId)).rejects.toThrow(SprintLockedException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();

      mockPrismaService.sprintWriteExtension.findFirst.mockResolvedValue({ expiresAt: dayOffset(1) });
      mockPrismaService.comment.update.mockResolvedValue({});
      await expect(service.remove(own.id, member.userId)).resolves.toBeDefined();
    });

    it('404 for an already-deleted comment, a non-member (BUG-40), or a deleted sprint', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, deletedAt: new Date() });
      await expect(service.remove(own.id, admin.userId)).rejects.toThrow(NotFoundException);

      mockPrismaService.comment.findUnique.mockResolvedValue(own);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.remove(own.id, 999)).rejects.toThrow(NotFoundException);

      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findUnique.mockResolvedValue({ ...own, sprint: { ...own.sprint, deletedAt: new Date() } });
      await expect(service.remove(own.id, admin.userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('feature 13 — setHighlighted on a soft-deleted comment', () => {
    it('404s', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ id: 1, teamId: sprint.teamId, deletedAt: new Date(), sprint: { deletedAt: null, team: { deletedAt: null } } });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      await expect(service.setHighlighted(1, { isHighlighted: true }, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.update).not.toHaveBeenCalled();
    });
  });

  describe('feature 13 — getDeletedComments', () => {
    const deletedAt = new Date('2026-10-20T10:00:00Z');
    const base = { content: 'c', postedByAdminId: null, deletedAt, author: { id: 5, username: 'nave' } };

    it('is admin only (a team leader / plain member gets 403, an outsider 404)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      await expect(service.getDeletedComments(sprint.id, teamLeader.userId)).rejects.toThrow(ForbiddenException);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
      await expect(service.getDeletedComments(sprint.id, member.userId)).rejects.toThrow(ForbiddenException);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.getDeletedComments(sprint.id, 999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.comment.findMany).not.toHaveBeenCalled();
    });

    it('lists deleted comments, newest deletion first, with who deleted and when', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { ...base, id: 1, isAnonymous: false, authorId: 5, deletedById: admin.userId, deletedBy: { id: admin.userId, username: 'boss' } },
      ]);

      const result: any[] = await service.getDeletedComments(sprint.id, admin.userId);

      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sprintId: sprint.id, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } })
      );
      expect(result[0]).toMatchObject({ id: 1, deletedAt, deletedBy: { username: 'boss' }, deletedByAuthor: false });
    });

    it('keeps anonymous comments masked and never names the deleter when the writer deleted it themselves (BUG-02)', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.comment.findMany.mockResolvedValue([
        { ...base, id: 2, isAnonymous: true, authorId: 6, deletedById: 6, deletedBy: { id: 6, username: 'liron' } },
        { ...base, id: 3, isAnonymous: true, authorId: 6, deletedById: admin.userId, deletedBy: { id: admin.userId, username: 'boss' } },
      ]);

      const [selfDeleted, moderated]: any[] = await service.getDeletedComments(sprint.id, admin.userId);

      for (const r of [selfDeleted, moderated]) {
        expect(r).not.toHaveProperty('authorId');
        expect(r).not.toHaveProperty('deletedById');
        expect(r.author.username).toBe('Anonymous');
      }
      expect(selfDeleted.deletedBy).toBeNull();
      expect(selfDeleted.deletedByAuthor).toBe(true);
      expect(moderated.deletedBy).toMatchObject({ username: 'boss' });
      expect(JSON.stringify([selfDeleted, moderated])).not.toContain('liron');
    });
  });
});
