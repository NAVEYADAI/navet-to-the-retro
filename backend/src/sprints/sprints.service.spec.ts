import { Test, TestingModule } from '@nestjs/testing';
import { SprintsService } from './sprints.service';
import { PrismaService } from '../prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { buildSprintSummaryPptx, buildExportFileName } from './sprint-summary.builder';

// The pptx generation itself (pptxgenjs + the transition/font/layout logic) has its own dedicated
// spec (sprint-summary.builder.spec.ts) — mocked here so these tests are only about the
// service's guard/lookup logic, not real file generation.
jest.mock('./sprint-summary.builder', () => {
  const actual = jest.requireActual('./sprint-summary.builder');
  return {
    ...actual,
    buildSprintSummaryPptx: jest.fn(),
    buildExportFileName: jest.fn(),
  };
});

describe('SprintsService', () => {
  let service: SprintsService;

  const activeTeam = { id: 1, name: 'Team A', status: 'ACTIVE' };
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
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
    },
    sprintLengthChange: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGoogleCalendarService = {
    syncSprintCreated: jest.fn().mockResolvedValue(undefined),
    syncSprintUpdated: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SprintsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GoogleCalendarService, useValue: mockGoogleCalendarService },
      ],
    }).compile();

    service = module.get<SprintsService>(SprintsService);

    // `create`/`update` now wrap their DB writes in `prisma.$transaction` (product-backlog/
    // 05-sprint-length-audit-log.md §5.1) — the mock just invokes the callback with the same
    // mock prisma object standing in for `tx`, so every existing `mockPrismaService.sprint.*`
    // assertion below keeps working unchanged.
    mockPrismaService.$transaction.mockImplementation((callback: (tx: typeof mockPrismaService) => unknown) =>
      callback(mockPrismaService)
    );
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

    it('syncs the newly created sprint to Google Calendar (best-effort)', async () => {
      const createdSprint = { id: 1, ...dto, teamId: activeTeam.id };
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.create.mockResolvedValue(createdSprint);

      await service.create(activeTeam.id, dto, admin.userId);

      expect(mockGoogleCalendarService.syncSprintCreated).toHaveBeenCalledWith(
        expect.objectContaining({ sprintId: createdSprint.id, teamId: activeTeam.id, teamName: activeTeam.name })
      );
    });

    it('does not let a Google Calendar sync failure fail sprint creation', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.create.mockResolvedValue({ id: 1, ...dto, teamId: activeTeam.id });
      mockGoogleCalendarService.syncSprintCreated.mockRejectedValueOnce(new Error('google is down'));

      await expect(service.create(activeTeam.id, dto, admin.userId)).resolves.toEqual(
        expect.objectContaining({ id: 1 })
      );
    });

    // product-backlog/05-sprint-length-audit-log.md §5.0 decision #4 / §5.3
    it('creates a baseline SprintLengthChange row alongside the sprint, inside the same transaction', async () => {
      const created = {
        id: 1,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        teamId: activeTeam.id,
      };
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.create.mockResolvedValue(created);

      await service.create(activeTeam.id, dto, admin.userId);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.sprintLengthChange.create).toHaveBeenCalledWith({
        data: {
          sprintId: created.id,
          changedById: admin.userId,
          previousStartDate: null,
          previousEndDate: null,
          newStartDate: created.startDate,
          newEndDate: created.endDate,
          reason: null,
        },
      });
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

  describe('update', () => {
    const existingSprint = {
      id: 5,
      teamId: activeTeam.id,
      name: 'Old name',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-14'),
    };
    const updateDto = { name: 'New name' };

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.update(activeTeam.id, existingSprint.id, updateDto, admin.userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not a team admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.update(activeTeam.id, existingSprint.id, updateDto, nonAdmin.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.sprint.findFirst).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester has no membership at all', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.update(activeTeam.id, existingSprint.id, updateDto, 999)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the sprint does not belong to the team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);

      await expect(service.update(activeTeam.id, 999, updateDto, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.sprint.update).not.toHaveBeenCalled();
    });

    it('updates only the fields provided, leaving the rest untouched', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue({ ...existingSprint, name: 'New name' });

      await service.update(activeTeam.id, existingSprint.id, { name: 'New name' }, admin.userId);

      expect(mockPrismaService.sprint.update).toHaveBeenCalledWith({
        where: { id: existingSprint.id },
        data: { name: 'New name' },
      });
    });

    it('converts provided date strings to Date objects and skips fields entirely omitted from the dto', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue({
        ...existingSprint,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-14'),
      });

      await service.update(activeTeam.id, existingSprint.id, { startDate: '2026-02-01', endDate: '2026-02-14' }, admin.userId);

      expect(mockPrismaService.sprint.update).toHaveBeenCalledWith({
        where: { id: existingSprint.id },
        data: { startDate: new Date('2026-02-01'), endDate: new Date('2026-02-14') },
      });
    });

    it('syncs the updated dates to Google Calendar when startDate/endDate actually change', async () => {
      const updatedSprint = { ...existingSprint, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-14') };
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue(updatedSprint);

      await service.update(activeTeam.id, existingSprint.id, { startDate: '2026-02-01', endDate: '2026-02-14' }, admin.userId);

      expect(mockGoogleCalendarService.syncSprintUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ sprintId: existingSprint.id, startDate: updatedSprint.startDate, endDate: updatedSprint.endDate })
      );
    });

    it('does not touch Google Calendar when only non-date fields change', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue({ ...existingSprint, name: 'New name' });

      await service.update(activeTeam.id, existingSprint.id, { name: 'New name' }, admin.userId);

      expect(mockGoogleCalendarService.syncSprintUpdated).not.toHaveBeenCalled();
    });

    it('does not let a Google Calendar sync failure fail the sprint update', async () => {
      const updatedSprint = { ...existingSprint, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-14') };
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue(updatedSprint);
      mockGoogleCalendarService.syncSprintUpdated.mockRejectedValueOnce(new Error('google is down'));

      await expect(
        service.update(activeTeam.id, existingSprint.id, { startDate: '2026-02-01', endDate: '2026-02-14' }, admin.userId)
      ).resolves.toEqual(updatedSprint);
    });

    // product-backlog/05-sprint-length-audit-log.md §5.1 / §5.3
    it('creates a SprintLengthChange row with the old/new values and reason when dates actually change', async () => {
      const updatedSprint = { ...existingSprint, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-14') };
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue(updatedSprint);

      await service.update(
        activeTeam.id,
        existingSprint.id,
        { startDate: '2026-02-01', endDate: '2026-02-14', reason: 'לקוח ביקש דחייה' },
        admin.userId
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.sprintLengthChange.create).toHaveBeenCalledWith({
        data: {
          sprintId: existingSprint.id,
          changedById: admin.userId,
          previousStartDate: existingSprint.startDate,
          previousEndDate: existingSprint.endDate,
          newStartDate: updatedSprint.startDate,
          newEndDate: updatedSprint.endDate,
          reason: 'לקוח ביקש דחייה',
        },
      });
    });

    it('does not create a SprintLengthChange row when only name/description change', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue({ ...existingSprint, name: 'New name' });

      await service.update(activeTeam.id, existingSprint.id, { name: 'New name' }, admin.userId);

      expect(mockPrismaService.sprintLengthChange.create).not.toHaveBeenCalled();
    });

    it('does not create a SprintLengthChange row when a date is sent but is identical to the existing one', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(activeTeam);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprint.findFirst.mockResolvedValue(existingSprint);
      mockPrismaService.sprint.update.mockResolvedValue({ ...existingSprint });

      await service.update(
        activeTeam.id,
        existingSprint.id,
        { startDate: existingSprint.startDate.toISOString(), endDate: existingSprint.endDate.toISOString() },
        admin.userId
      );

      expect(mockPrismaService.sprintLengthChange.create).not.toHaveBeenCalled();
    });
  });

  describe('getLengthHistory', () => {
    const sprint = { id: 5, teamId: activeTeam.id, name: 'Sprint 1' };
    const teamLeader = { userId: 30, teamId: activeTeam.id, isAdmin: false, role: 'TEAM_LEADER' };
    const regularMember = { userId: 40, teamId: activeTeam.id, isAdmin: false, role: 'DEVELOPER' };
    const changer = { id: admin.userId, username: 'admin-user', password: 'hashed', firstName: 'A', lastName: 'B' };

    const records = [
      {
        id: 2,
        sprintId: sprint.id,
        changedById: admin.userId,
        previousStartDate: new Date('2026-01-01'),
        previousEndDate: new Date('2026-01-14'),
        newStartDate: new Date('2026-02-01'),
        newEndDate: new Date('2026-02-14'),
        reason: null,
        createdAt: new Date('2026-02-01T00:00:00Z'),
        changedBy: changer,
      },
      {
        id: 1,
        sprintId: sprint.id,
        changedById: admin.userId,
        previousStartDate: null,
        previousEndDate: null,
        newStartDate: new Date('2026-01-01'),
        newEndDate: new Date('2026-01-14'),
        reason: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        changedBy: changer,
      },
    ];

    it('throws NotFoundException when the sprint does not belong to the team', async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);

      await expect(service.getLengthHistory(activeTeam.id, 999, admin.userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.teamMember.findUnique).not.toHaveBeenCalled();
    });

    it('blocks a regular team member with ForbiddenException (403)', async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(regularMember);

      await expect(service.getLengthHistory(activeTeam.id, sprint.id, regularMember.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.sprintLengthChange.findMany).not.toHaveBeenCalled();
    });

    it('allows a team admin', async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprintLengthChange.findMany.mockResolvedValue(records);

      await expect(service.getLengthHistory(activeTeam.id, sprint.id, admin.userId)).resolves.toBeDefined();
    });

    it('allows a TEAM_LEADER who is not an admin', async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(teamLeader);
      mockPrismaService.sprintLengthChange.findMany.mockResolvedValue(records);

      await expect(service.getLengthHistory(activeTeam.id, sprint.id, teamLeader.userId)).resolves.toBeDefined();
    });

    it('sorts by createdAt desc, strips password from changedBy, and includes baseline + updates', async () => {
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(admin);
      mockPrismaService.sprintLengthChange.findMany.mockResolvedValue(records);

      const result = await service.getLengthHistory(activeTeam.id, sprint.id, admin.userId);

      expect(mockPrismaService.sprintLengthChange.findMany).toHaveBeenCalledWith({
        where: { sprintId: sprint.id },
        orderBy: { createdAt: 'desc' },
        include: { changedBy: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
      expect(result[1].previousStartDate).toBeNull();
      expect(result[0].changedBy).not.toHaveProperty('password');
    });
  });

  describe('exportSummaryPptx', () => {
    // Team.creatorId===10 in all of these — matches `admin.userId` above so the "creator" and
    // "admin" cases stay clearly distinguishable from a plain member.
    const team = { id: activeTeam.id, name: 'Team A', creatorId: admin.userId };
    const sprint = { id: 5, name: 'Sprint 1', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-14') };
    const comments = [{ content: 'x', type: 'KEEP', category: null }];

    beforeEach(() => {
      (buildSprintSummaryPptx as jest.Mock).mockResolvedValue(Buffer.from('fake-pptx'));
      (buildExportFileName as jest.Mock).mockReturnValue('Sprint 1 - 1.1.2026.pptx');
    });

    it('throws NotFoundException when the team does not exist', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.exportSummaryPptx(team.id, sprint.id, 999)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is neither the creator nor an admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(nonAdmin);

      await expect(service.exportSummaryPptx(team.id, sprint.id, nonAdmin.userId)).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.sprint.findFirst).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester has no membership at all', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.exportSummaryPptx(team.id, sprint.id, 999)).rejects.toThrow(ForbiddenException);
    });

    it('succeeds for the team creator, without needing a membership lookup', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.comment.findMany.mockResolvedValue(comments);

      const result = await service.exportSummaryPptx(team.id, sprint.id, team.creatorId);

      expect(mockPrismaService.teamMember.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({ buffer: Buffer.from('fake-pptx'), fileName: 'Sprint 1 - 1.1.2026.pptx' });
    });

    it('succeeds for a non-creator team admin', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.teamMember.findUnique.mockResolvedValue({ ...admin, userId: 30 });
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.comment.findMany.mockResolvedValue(comments);

      const result = await service.exportSummaryPptx(team.id, sprint.id, 30);

      expect(result.fileName).toBe('Sprint 1 - 1.1.2026.pptx');
    });

    it('throws NotFoundException when the sprint does not belong to the team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.sprint.findFirst.mockResolvedValue(null);

      await expect(service.exportSummaryPptx(team.id, 999, team.creatorId)).rejects.toThrow(NotFoundException);
      expect(buildSprintSummaryPptx).not.toHaveBeenCalled();
    });

    it('passes the resolved template id and comment data through to the pptx builder', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.comment.findMany.mockResolvedValue(comments);

      await service.exportSummaryPptx(team.id, sprint.id, team.creatorId, 'dark');

      expect(buildSprintSummaryPptx).toHaveBeenCalledWith(
        expect.objectContaining({ sprintName: sprint.name, teamName: team.name, comments, templateId: 'dark' })
      );
    });

    it('falls back to the classic template for an unrecognized template id', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(team);
      mockPrismaService.sprint.findFirst.mockResolvedValue(sprint);
      mockPrismaService.comment.findMany.mockResolvedValue(comments);

      await service.exportSummaryPptx(team.id, sprint.id, team.creatorId, 'not-a-real-template');

      expect(buildSprintSummaryPptx).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'classic' }));
    });
  });
});
