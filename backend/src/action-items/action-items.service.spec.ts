import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { PrismaService } from '../prisma.service';

describe('ActionItemsService', () => {
  let service: ActionItemsService;

  const team = { id: 10, name: 'Core Team', deletedAt: null };
  const sprint = { id: 5, teamId: team.id, name: 'S5', deletedAt: null, team: { deletedAt: null } };
  const member = { userId: 1, teamId: team.id, isAdmin: false, role: 'DEVELOPER', status: 'ACTIVE' };

  const mockPrismaService = {
    team: { findUnique: jest.fn() },
    teamMember: { findUnique: jest.fn(), findMany: jest.fn() },
    sprint: { findUnique: jest.fn() },
    comment: { findFirst: jest.fn() },
    actionItem: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    actionItemAssignee: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn()
  };

  const item = (overrides: Record<string, unknown> = {}) => ({
    id: 100,
    teamId: team.id,
    sprintId: sprint.id,
    sourceCommentId: null,
    title: 'לשפר את ה-CI',
    status: 'OPEN',
    dueDate: null,
    createdById: member.userId,
    createdAt: new Date('2026-10-01'),
    closedAt: null,
    assignees: [],
    ...overrides
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionItemsService, { provide: PrismaService, useValue: mockPrismaService }]
    }).compile();
    service = module.get(ActionItemsService);

    mockPrismaService.team.findUnique.mockResolvedValue(team);
    mockPrismaService.sprint.findUnique.mockResolvedValue(sprint);
    mockPrismaService.teamMember.findUnique.mockResolvedValue(member);
    mockPrismaService.teamMember.findMany.mockResolvedValue([]);
    mockPrismaService.$transaction.mockImplementation((cb: (tx: typeof mockPrismaService) => unknown) => cb(mockPrismaService));
    mockPrismaService.actionItem.create.mockImplementation(({ data }: any) =>
      Promise.resolve(item({ ...data, assignees: (data.assignees?.create ?? []).map((a: any) => ({ userId: a.userId })) }))
    );
    mockPrismaService.actionItem.update.mockImplementation(({ data }: any) => Promise.resolve(item(data)));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('listForTeam', () => {
    it('404s for a missing or soft-deleted team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      await expect(service.listForTeam(team.id, 1)).rejects.toThrow(NotFoundException);
      mockPrismaService.team.findUnique.mockResolvedValue({ ...team, deletedAt: new Date() });
      await expect(service.listForTeam(team.id, 1)).rejects.toThrow(NotFoundException);
    });

    it('403s for a non-member and for a PENDING invitee', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.listForTeam(team.id, 99)).rejects.toThrow(ForbiddenException);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...member, status: 'PENDING' });
      await expect(service.listForTeam(team.id, 99)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.actionItem.findMany).not.toHaveBeenCalled();
    });

    it('rejects an unknown status filter with 400', async () => {
      await expect(service.listForTeam(team.id, 1, 'WHATEVER')).rejects.toThrow(BadRequestException);
    });

    it('filters by status when given', async () => {
      mockPrismaService.actionItem.findMany.mockResolvedValue([]);
      await service.listForTeam(team.id, 1, 'DONE');
      expect(mockPrismaService.actionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: team.id, status: 'DONE' } })
      );
    });

    it('lists open first, then by due date (undated last), and flags assignees who left', async () => {
      mockPrismaService.actionItem.findMany.mockResolvedValue([
        item({ id: 1, status: 'DONE' }),
        item({ id: 2, dueDate: null, createdAt: new Date('2026-10-01') }),
        item({ id: 3, dueDate: new Date('2026-11-02'), assignees: [{ userId: 7 }, { userId: 8 }] }),
        item({ id: 4, dueDate: new Date('2026-11-01') })
      ]);
      mockPrismaService.teamMember.findMany.mockResolvedValue([{ teamId: team.id, userId: 7 }]);

      const result = await service.listForTeam(team.id, 1);

      expect(result.map(r => r.id)).toEqual([4, 3, 2, 1]);
      expect(result[1].assignees).toEqual([
        { userId: 7, isActiveMember: true },
        { userId: 8, isActiveMember: false }
      ]);
    });
  });

  describe('listMine', () => {
    it('defaults to OPEN items assigned to me in live teams I am an active member of', async () => {
      mockPrismaService.actionItem.findMany.mockResolvedValue([]);
      await service.listMine(1);
      expect(mockPrismaService.actionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'OPEN',
            assignees: { some: { userId: 1 } },
            team: { deletedAt: null, members: { some: { userId: 1, status: 'ACTIVE' } } }
          }
        })
      );
    });
  });

  describe('create', () => {
    it('404s for a missing or soft-deleted sprint and for a sprint of a deleted team', async () => {
      mockPrismaService.sprint.findUnique.mockResolvedValue(null);
      await expect(service.create(5, { title: 'x' }, 1)).rejects.toThrow(NotFoundException);
      mockPrismaService.sprint.findUnique.mockResolvedValue({ ...sprint, deletedAt: new Date() });
      await expect(service.create(5, { title: 'x' }, 1)).rejects.toThrow(NotFoundException);
      mockPrismaService.sprint.findUnique.mockResolvedValue({ ...sprint, team: { deletedAt: new Date() } });
      await expect(service.create(5, { title: 'x' }, 1)).rejects.toThrow(NotFoundException);
    });

    it('404s (same as a missing sprint) for a non-member', async () => {
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.create(5, { title: 'x' }, 99)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.actionItem.create).not.toHaveBeenCalled();
    });

    it.each([undefined, '', '   ', 5, null])('rejects title %p with 400', async title => {
      await expect(service.create(5, { title } as any, 1)).rejects.toThrow(BadRequestException);
    });

    it('rejects an over-long title', async () => {
      await expect(service.create(5, { title: 'א'.repeat(501) }, 1)).rejects.toThrow(BadRequestException);
    });

    it('rejects malformed assigneeIds / sourceCommentId / dueDate with 400', async () => {
      await expect(service.create(5, { title: 'x', assigneeIds: 'nope' as any }, 1)).rejects.toThrow(BadRequestException);
      await expect(service.create(5, { title: 'x', assigneeIds: ['a'] as any }, 1)).rejects.toThrow(BadRequestException);
      await expect(service.create(5, { title: 'x', sourceCommentId: 'a' as any }, 1)).rejects.toThrow(BadRequestException);
      await expect(service.create(5, { title: 'x', dueDate: 'not-a-date' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('400s when the source comment is not in the sprint\'s team', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValue(null);
      await expect(service.create(5, { title: 'x', sourceCommentId: 77 }, 1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.comment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 77, teamId: team.id } })
      );
    });

    it('400s when an assignee is not an ACTIVE member of the team', async () => {
      mockPrismaService.teamMember.findMany.mockResolvedValue([{ userId: 1 }]);
      await expect(service.create(5, { title: 'x', assigneeIds: [1, 2] }, 1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.actionItem.create).not.toHaveBeenCalled();
    });

    it('creates a task with several assignees, de-duplicated, linked to the source comment', async () => {
      mockPrismaService.comment.findFirst.mockResolvedValue({ id: 77 });
      mockPrismaService.teamMember.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);

      const result = await service.create(
        5,
        { title: '  להוסיף בדיקות  ', sourceCommentId: 77, assigneeIds: [1, 2, 2], dueDate: '2026-10-20' },
        1
      );

      const data = mockPrismaService.actionItem.create.mock.calls[0][0].data;
      expect(data.title).toBe('להוסיף בדיקות');
      expect(data.teamId).toBe(team.id);
      expect(data.sprintId).toBe(5);
      expect(data.sourceCommentId).toBe(77);
      expect(data.createdById).toBe(1);
      expect(data.dueDate).toBeInstanceOf(Date);
      expect(data.assignees.create).toEqual([{ userId: 1 }, { userId: 2 }]);
      expect(result.assignees).toHaveLength(2);
    });

    it('creates an unassigned, undated free task', async () => {
      const result = await service.create(5, { title: 'x' }, 1);
      const data = mockPrismaService.actionItem.create.mock.calls[0][0].data;
      expect(data.sourceCommentId).toBeNull();
      expect(data.dueDate).toBeNull();
      expect(data.assignees.create).toEqual([]);
      expect(result.status).toBe('OPEN');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item(), team: { deletedAt: null } });
    });

    it('400s when nothing is sent', async () => {
      await expect(service.update(100, {}, 1)).rejects.toThrow(BadRequestException);
    });

    it('404s for a missing item, an item of a deleted team, and a non-member', async () => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue(null);
      await expect(service.update(100, { title: 'x' }, 1)).rejects.toThrow(NotFoundException);
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item(), team: { deletedAt: new Date() } });
      await expect(service.update(100, { title: 'x' }, 1)).rejects.toThrow(NotFoundException);
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item(), team: { deletedAt: null } });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.update(100, { title: 'x' }, 99)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.actionItem.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid status and a blank title', async () => {
      await expect(service.update(100, { status: 'BOGUS' as any }, 1)).rejects.toThrow(BadRequestException);
      await expect(service.update(100, { title: ' ' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('sets closedAt when closing, clears it on reopen, leaves it alone when status is unchanged', async () => {
      await service.update(100, { status: 'DONE' }, 1);
      expect(mockPrismaService.actionItem.update.mock.calls[0][0].data).toMatchObject({ status: 'DONE', closedAt: expect.any(Date) });

      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item({ status: 'DONE', closedAt: new Date() }), team: { deletedAt: null } });
      await service.update(100, { status: 'OPEN' }, 1);
      expect(mockPrismaService.actionItem.update.mock.calls[1][0].data).toMatchObject({ status: 'OPEN', closedAt: null });

      await service.update(100, { status: 'DONE', title: 'same status' }, 1);
      const data = mockPrismaService.actionItem.update.mock.calls[2][0].data;
      expect(data.status).toBeUndefined();
      expect(data.closedAt).toBeUndefined();
    });

    it('works on an item born in a locked/old sprint (no write-window check)', async () => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item({ sprintId: 1 }), team: { deletedAt: null } });
      await expect(service.update(100, { status: 'DROPPED' }, 1)).resolves.toBeDefined();
      expect(mockPrismaService.sprint.findUnique).not.toHaveBeenCalled();
    });

    it('replaces assignees: removes dropped ones, adds new active ones, keeps a departed one that stays', async () => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue({
        ...item({ assignees: [{ userId: 7 }, { userId: 8 }] }),
        team: { deletedAt: null }
      });
      mockPrismaService.teamMember.findMany.mockResolvedValue([{ userId: 9 }]);

      await service.update(100, { assigneeIds: [8, 9] }, 1);

      // Only the NEW id (9) is checked for active membership; 8 may have left and still stays.
      expect(mockPrismaService.teamMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: team.id, status: 'ACTIVE', userId: { in: [9] } } })
      );
      expect(mockPrismaService.actionItemAssignee.deleteMany).toHaveBeenCalledWith({
        where: { actionItemId: 100, userId: { notIn: [8, 9] } }
      });
      expect(mockPrismaService.actionItemAssignee.createMany).toHaveBeenCalledWith({
        data: [{ actionItemId: 100, userId: 9 }],
        skipDuplicates: true
      });
    });

    it('400s when a newly added assignee is not an active member', async () => {
      mockPrismaService.teamMember.findMany.mockResolvedValue([]);
      await expect(service.update(100, { assigneeIds: [42] }, 1)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.actionItem.update).not.toHaveBeenCalled();
    });

    it('clears the due date with null and parses a new one', async () => {
      await service.update(100, { dueDate: null }, 1);
      expect(mockPrismaService.actionItem.update.mock.calls[0][0].data.dueDate).toBeNull();
      await service.update(100, { dueDate: '2026-12-01' }, 1);
      expect(mockPrismaService.actionItem.update.mock.calls[1][0].data.dueDate).toBeInstanceOf(Date);
      await expect(service.update(100, { dueDate: 'zzz' }, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('hard-deletes for any active member', async () => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item(), team: { deletedAt: null } });
      await expect(service.remove(100, 1)).resolves.toEqual({ success: true });
      expect(mockPrismaService.actionItem.delete).toHaveBeenCalledWith({ where: { id: 100 } });
    });

    it('404s for a non-member without deleting', async () => {
      mockPrismaService.actionItem.findUnique.mockResolvedValue({ ...item(), team: { deletedAt: null } });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.remove(100, 99)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.actionItem.delete).not.toHaveBeenCalled();
    });
  });
});
