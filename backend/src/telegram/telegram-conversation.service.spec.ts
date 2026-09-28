import { Test, TestingModule } from '@nestjs/testing';
import { TelegramConversationService } from './telegram-conversation.service';
import { PrismaService } from '../prisma.service';
import { TelegramApiService } from './telegram-api.service';
import { CommentsService } from '../comments/comments.service';
import { TeamCategoriesService } from '../team-categories/team-categories.service';

describe('TelegramConversationService', () => {
  let service: TelegramConversationService;

  const baseLink = {
    id: 1,
    userId: 42,
    channel: 'TELEGRAM' as const,
    externalId: '555',
    isRevoked: false,
    activeTeamId: null as number | null,
    activeSprintId: null as number | null,
    pendingCommentContent: null as string | null,
    pendingCommentType: null as 'KEEP' | 'IMPROVE' | null,
    lastProcessedUpdateId: null as number | null,
    linkedAt: new Date(),
    contextSetAt: null as Date | null,
    contextStickyHours: 24 as number | null,
    awaitingContextConfirm: false,
  };

  const mockPrisma = {
    userMessagingLink: { findUnique: jest.fn(), update: jest.fn() },
    teamMember: { findMany: jest.fn(), findUnique: jest.fn() },
    sprint: { findMany: jest.fn(), findUnique: jest.fn() },
    team: { findUnique: jest.fn() },
  };
  const mockTelegramApi = { sendMessage: jest.fn() };
  const mockCommentsService = { create: jest.fn() };
  const mockTeamCategoriesService = { listCategories: jest.fn() };

  // Sequential `userMessagingLink.update` calls within one message must accumulate onto each
  // other (team set, then sprint set, then pendingCommentContent cleared, ...) like a real DB
  // would — `linkState` is the stateful accumulator, seeded per-test via `seedLink()`.
  let linkState: Record<string, unknown>;
  function seedLink(link: Record<string, unknown>) {
    linkState = { ...link };
  }

  /** Wires teamMember.findMany + sprint.findMany for both resolve stages at once.
   *  `memberships`: teams the user is an ACTIVE member of. `sprintsByTeam`: open sprints per
   *  team id — a team is only an open-team-candidate if its array here is non-empty. */
  function setupTeamsAndSprints(
    memberships: { teamId: number; teamName: string }[],
    sprintsByTeam: Record<number, { id: number; name: string }[]>
  ) {
    mockPrisma.teamMember.findMany.mockResolvedValue(
      memberships.map((m) => ({ teamId: m.teamId, team: { name: m.teamName } }))
    );
    mockPrisma.sprint.findMany.mockImplementation((args: any) => {
      if (args?.where?.teamId?.in) {
        const openTeamIds = Object.entries(sprintsByTeam)
          .filter(([, sprints]) => sprints.length > 0)
          .map(([teamId]) => Number(teamId));
        return Promise.resolve(openTeamIds.map((teamId) => ({ teamId })));
      }
      const teamId = args.where.teamId as number;
      return Promise.resolve(sprintsByTeam[teamId] ?? []);
    });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramConversationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TelegramApiService, useValue: mockTelegramApi },
        { provide: CommentsService, useValue: mockCommentsService },
        { provide: TeamCategoriesService, useValue: mockTeamCategoriesService },
      ],
    }).compile();

    service = module.get(TelegramConversationService);
    seedLink(baseLink);
    mockPrisma.userMessagingLink.update.mockImplementation(({ data }: any) => {
      linkState = { ...linkState, ...data };
      return Promise.resolve({ ...linkState });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findActiveLink / isDuplicateUpdate', () => {
    it('returns null when no link row exists', async () => {
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue(null);
      await expect(service.findActiveLink('TELEGRAM', '555')).resolves.toBeNull();
    });

    it('returns null when the link is revoked', async () => {
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue({ ...baseLink, isRevoked: true });
      await expect(service.findActiveLink('TELEGRAM', '555')).resolves.toBeNull();
    });

    it('returns the link when active', async () => {
      mockPrisma.userMessagingLink.findUnique.mockResolvedValue(baseLink);
      await expect(service.findActiveLink('TELEGRAM', '555')).resolves.toEqual(baseLink);
    });

    it('treats update_id <= lastProcessedUpdateId as a duplicate', () => {
      const link = { ...baseLink, lastProcessedUpdateId: 10 };
      expect(service.isDuplicateUpdate(link, 10)).toBe(true);
      expect(service.isDuplicateUpdate(link, 5)).toBe(true);
      expect(service.isDuplicateUpdate(link, 11)).toBe(false);
    });

    it('is never a duplicate when nothing has been processed yet', () => {
      expect(service.isDuplicateUpdate(baseLink, 1)).toBe(false);
    });
  });

  describe('handleTextMessage — team + sprint resolution', () => {
    it('sends the "no open team" message and marks processed when the user has no open-sprint team', async () => {
      setupTeamsAndSprints([], {});

      await service.handleTextMessage(baseLink, 'hello', 7);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('אין לך צוות'));
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { lastProcessedUpdateId: 7 } });
    });

    it('silently resolves a single team + single sprint and asks Keep/Improve with a team/sprint recap', async () => {
      setupTeamsAndSprints([{ teamId: 10, teamName: 'Team A' }], { 10: [{ id: 100, name: 'Sprint 1' }] });
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team A' });
      mockPrisma.sprint.findUnique.mockResolvedValue({ name: 'Sprint 1' });

      await service.handleTextMessage(baseLink, 'this is my comment', 7);

      expect(mockTelegramApi.sendMessage).not.toHaveBeenCalledWith('555', expect.stringContaining('לאיזו קבוצה'));
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: 10 }) })
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: 100 }) })
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: 'this is my comment' }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith(
        '555',
        expect.stringMatching(/Team A[\s\S]*Sprint 1[\s\S]*שימור/),
        expect.anything()
      );
    });

    it('presents a numbered list when the user belongs to multiple open-sprint teams, holding the message as a draft', async () => {
      setupTeamsAndSprints(
        [
          { teamId: 10, teamName: 'Team A' },
          { teamId: 20, teamName: 'Team B' },
        ],
        { 10: [{ id: 100, name: 'Sprint 1' }], 20: [{ id: 200, name: 'Sprint 2' }] }
      );

      await service.handleTextMessage(baseLink, 'first free-text message', 7);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Team A'), expect.anything());
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Team B'), expect.anything());
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { pendingCommentContent: 'first free-text message' },
      });
    });

    it('does not overwrite an already-held draft with a second, still-unmatched attempt', async () => {
      const linkWithDraft = { ...baseLink, pendingCommentContent: 'already held' };
      seedLink(linkWithDraft);
      setupTeamsAndSprints(
        [
          { teamId: 10, teamName: 'Team A' },
          { teamId: 20, teamName: 'Team B' },
        ],
        { 10: [{ id: 100, name: 'Sprint 1' }], 20: [{ id: 200, name: 'Sprint 2' }] }
      );

      await service.handleTextMessage(linkWithDraft, 'not a team name', 7);

      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: expect.anything() }) })
      );
    });

    it('continues straight through a single-sprint team to Keep/Improve when a draft was already held', async () => {
      const linkWithDraft = { ...baseLink, pendingCommentContent: 'held draft text' };
      seedLink(linkWithDraft);
      setupTeamsAndSprints(
        [
          { teamId: 10, teamName: 'Team A' },
          { teamId: 20, teamName: 'Team B' },
        ],
        { 10: [{ id: 100, name: 'Sprint 1' }], 20: [{ id: 200, name: 'Sprint 2' }] }
      );
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team B' });

      await service.handleTextMessage(linkWithDraft, '2', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: 20 }) })
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: 200 }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Team B'));
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('שימור'), expect.anything());
    });

    it('asks which sprint when the picked team has more than one open sprint', async () => {
      setupTeamsAndSprints(
        [{ teamId: 10, teamName: 'Team A' }],
        {
          10: [
            { id: 100, name: 'Sprint 1' },
            { id: 101, name: 'Sprint 2' },
          ],
        }
      );

      await service.handleTextMessage(baseLink, 'my comment', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: 10 }) })
      );
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: expect.anything() }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('איזה ספרינט'), expect.anything());
      // The original free text is held as a draft across the sprint stage too.
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { pendingCommentContent: 'my comment' },
      });
    });

    it('resolves a sprint-list answer and asks Keep/Improve using the held draft', async () => {
      const linkAwaitingSprint = { ...baseLink, activeTeamId: 10, pendingCommentContent: 'my comment' };
      seedLink(linkAwaitingSprint);
      setupTeamsAndSprints(
        [{ teamId: 10, teamName: 'Team A' }],
        {
          10: [
            { id: 100, name: 'Sprint 1' },
            { id: 101, name: 'Sprint 2' },
          ],
        }
      );
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team A' });

      await service.handleTextMessage(linkAwaitingSprint, '2', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: 101 }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Sprint 2'));
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('שימור'), expect.anything());
    });

    it('resolves a numbered-list team answer by index and confirms the selection (without a held draft, no comment created)', async () => {
      setupTeamsAndSprints(
        [
          { teamId: 10, teamName: 'Team A' },
          { teamId: 20, teamName: 'Team B' },
        ],
        { 10: [{ id: 100, name: 'Sprint 1' }], 20: [{ id: 200, name: 'Sprint 2' }] }
      );

      await service.handleTextMessage(baseLink, '2', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: 20 }) })
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: 200 }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Team B'));
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: expect.anything() }) })
      );
    });

    it('re-validates an existing active context and clears it (re-resolving) when the sprint is no longer open', async () => {
      const linkWithContext = { ...baseLink, activeTeamId: 10, activeSprintId: 100 };
      seedLink(linkWithContext);
      mockPrisma.teamMember.findUnique.mockResolvedValue({ userId: 42, teamId: 10, status: 'ACTIVE' });
      mockPrisma.sprint.findUnique.mockResolvedValue({
        id: 100,
        teamId: 10,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-01-15'), // long closed
      });
      setupTeamsAndSprints([], {});

      await service.handleTextMessage(linkWithContext, 'hello again', 8);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activeTeamId: null, activeSprintId: null, pendingCommentContent: null, pendingCommentType: null }),
        })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('אין לך צוות'));
    });

    it('re-validates and clears an existing context once contextStickyHours has elapsed (time-based expiry)', async () => {
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago, sticky = 24h
      const linkWithStaleContext = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        contextSetAt: staleDate,
        contextStickyHours: 24,
      };
      seedLink(linkWithStaleContext);
      // Membership + sprint are otherwise perfectly valid — only the age should trip expiry.
      mockPrisma.teamMember.findUnique.mockResolvedValue({ userId: 42, teamId: 10, status: 'ACTIVE' });
      mockPrisma.sprint.findUnique.mockResolvedValue({
        id: 100,
        teamId: 10,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });
      setupTeamsAndSprints([], {});

      await service.handleTextMessage(linkWithStaleContext, 'hello', 8);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ activeTeamId: null, activeSprintId: null }),
        })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('אין לך צוות'));
    });

    it('never expires the context when contextStickyHours is null', async () => {
      const veryOldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365); // a year ago
      const linkWithNoExpiry = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        contextSetAt: veryOldDate,
        contextStickyHours: null,
      };
      seedLink(linkWithNoExpiry);
      mockPrisma.teamMember.findUnique.mockResolvedValue({ userId: 42, teamId: 10, status: 'ACTIVE' });
      mockPrisma.sprint.findUnique.mockResolvedValue({
        id: 100,
        teamId: 10,
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        name: 'Sprint 1',
      });
      mockTeamCategoriesService.listCategories.mockResolvedValue([]);

      await service.handleTextMessage(linkWithNoExpiry, 'my comment', 8);

      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: null }) })
      );
    });
  });

  describe('handleTextMessage — "🔙 החלף צוות" (switch team)', () => {
    it('clears the active context and pending comment from any step, then re-runs resolution', async () => {
      const linkMidFlow = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        pendingCommentContent: 'draft text',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkMidFlow);
      setupTeamsAndSprints([{ teamId: 10, teamName: 'Team A' }], { 10: [{ id: 100, name: 'Sprint 1' }] });

      await service.handleTextMessage(linkMidFlow, '🔙 החלף צוות', 9);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          activeTeamId: null,
          activeSprintId: null,
          pendingCommentContent: null,
          pendingCommentType: null,
          contextSetAt: null,
          awaitingContextConfirm: false,
        },
      });
    });
  });

  describe('handleTextMessage — "🗑️ מחק הערה" (cancel)', () => {
    it('clears only the in-progress comment, keeps the active team/sprint context, and confirms', async () => {
      const linkMidComment = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        pendingCommentContent: 'draft text',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkMidComment);

      await service.handleTextMessage(linkMidComment, '🗑️ מחק הערה', 9);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { pendingCommentContent: null, pendingCommentType: null },
      });
      // Unlike switch-team, activeTeamId/activeSprintId are never touched.
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: null }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('נמחקה'));
      expect(mockPrisma.teamMember.findMany).not.toHaveBeenCalled();
    });

    it('works mid-way through the category question too', async () => {
      const linkAwaitingCategory = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        pendingCommentContent: 'draft text',
        pendingCommentType: null,
      };
      seedLink(linkAwaitingCategory);

      await service.handleTextMessage(linkAwaitingCategory, 'cancel', 9);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { pendingCommentContent: null, pendingCommentType: null },
      });
      expect(mockCommentsService.create).not.toHaveBeenCalled();
    });

    it('says there is nothing to cancel when there is no in-progress comment, without touching the DB', async () => {
      const linkNoPending = { ...baseLink, activeTeamId: 10, activeSprintId: 100 };
      seedLink(linkNoPending);

      await service.handleTextMessage(linkNoPending, '🗑️ מחק הערה', 9);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('אין'));
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: null }) })
      );
    });
  });

  describe('handleTextMessage — "↩️ חזור" (back one step)', () => {
    it('from the category question, clears only pendingCommentType and re-asks Keep/Improve (keeps the note)', async () => {
      const linkAwaitingCategory = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        pendingCommentContent: 'draft text',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkAwaitingCategory);

      await service.handleTextMessage(linkAwaitingCategory, '↩️ חזור', 9);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { pendingCommentType: null },
      });
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: null }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('שימור'), expect.anything());
    });

    it('from the Keep/Improve question with a single team, forces an explicit re-confirm (list-of-one) instead of silently reusing it', async () => {
      const linkAwaitingType = {
        ...baseLink,
        activeTeamId: 10,
        activeSprintId: 100,
        pendingCommentContent: 'draft text',
        pendingCommentType: null,
      };
      seedLink(linkAwaitingType);
      setupTeamsAndSprints([{ teamId: 10, teamName: 'Team A' }], { 10: [{ id: 100, name: 'Sprint 1' }] });

      await service.handleTextMessage(linkAwaitingType, '↩️ חזור', 9);

      // Team/sprint context is cleared and marked as awaiting explicit confirmation.
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { activeTeamId: null, activeSprintId: null, contextSetAt: null, awaitingContextConfirm: true },
      });
      // The note itself is preserved (never cleared).
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: null }) })
      );
      // Even with only one team, it's presented as an explicit choice (with a delete option),
      // not silently re-applied.
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith(
        '555',
        expect.stringContaining('Team A'),
        expect.objectContaining({ keyboard: [['Team A'], ['🗑️ מחק הערה']] })
      );
    });

    it('confirming the single team after "↩️ חזור" continues straight back to Keep/Improve (sprint resolves silently)', async () => {
      const linkAwaitingConfirm = {
        ...baseLink,
        pendingCommentContent: 'draft text',
        awaitingContextConfirm: true,
      };
      seedLink(linkAwaitingConfirm);
      setupTeamsAndSprints([{ teamId: 10, teamName: 'Team A' }], { 10: [{ id: 100, name: 'Sprint 1' }] });
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team A' });

      await service.handleTextMessage(linkAwaitingConfirm, 'Team A', 10);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeTeamId: 10, awaitingContextConfirm: false }) })
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ activeSprintId: 100 }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('שימור'), expect.anything());
    });

    it('says there is no previous step when there is nothing in progress', async () => {
      const linkNoPending = { ...baseLink, activeTeamId: 10, activeSprintId: 100 };
      seedLink(linkNoPending);

      await service.handleTextMessage(linkNoPending, '↩️ חזור', 9);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('אין שלב'));
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: expect.anything() }) })
      );
    });
  });

  describe('handleTextMessage — Keep/Improve + category flow', () => {
    const linkWithContext = { ...baseLink, activeTeamId: 10, activeSprintId: 100 };

    beforeEach(() => {
      seedLink(linkWithContext);
      // isContextStillOpen: valid membership + sprint currently in range.
      mockPrisma.teamMember.findUnique.mockResolvedValue({ userId: 42, teamId: 10, status: 'ACTIVE' });
      mockPrisma.sprint.findUnique.mockResolvedValue({
        id: 100,
        teamId: 10,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        name: 'Sprint 1',
      });
      mockPrisma.team.findUnique.mockResolvedValue({ name: 'Team A' });
    });

    it('asks Keep/Improve after a fresh free-text message, with a team/sprint recap', async () => {
      await service.handleTextMessage(linkWithContext, 'my retro comment', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: 'my retro comment' }) })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith(
        '555',
        expect.stringMatching(/Team A[\s\S]*Sprint 1[\s\S]*שימור/),
        expect.objectContaining({ keyboard: [['🔧 שיפור', '✅ שימור'], ['↩️ חזור', '🗑️ מחק הערה']] })
      );
    });

    it('re-asks Keep/Improve when the answer is not recognized', async () => {
      const linkAwaitingType = { ...linkWithContext, pendingCommentContent: 'my retro comment' };
      seedLink(linkAwaitingType);

      await service.handleTextMessage(linkAwaitingType, 'maybe?', 7);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('לא הבנתי'), expect.anything());
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentType: expect.anything() }) })
      );
    });

    it('stores the type and shows the enabled-category list on a recognized Keep/Improve answer', async () => {
      const linkAwaitingType = { ...linkWithContext, pendingCommentContent: 'my retro comment' };
      seedLink(linkAwaitingType);
      mockTeamCategoriesService.listCategories.mockResolvedValue([
        { id: 1, label: 'תקשורת' },
        { id: 2, label: 'תהליכים' },
      ]);

      await service.handleTextMessage(linkAwaitingType, 'Keep', 7);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentType: 'KEEP' }) })
      );
      expect(mockTeamCategoriesService.listCategories).toHaveBeenCalledWith(10, 42, true);
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith(
        '555',
        expect.stringContaining('תקשורת'),
        expect.objectContaining({ keyboard: [['תקשורת'], ['תהליכים'], ['⏭️ דלג'], ['↩️ חזור', '🗑️ מחק הערה']] })
      );
    });

    it('creates the comment via CommentsService.create on a valid category choice and clears pending state', async () => {
      const linkAwaitingCategory = {
        ...linkWithContext,
        pendingCommentContent: 'my retro comment',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkAwaitingCategory);
      mockTeamCategoriesService.listCategories.mockResolvedValue([
        { id: 1, label: 'תקשורת' },
        { id: 2, label: 'תהליכים' },
      ]);
      mockCommentsService.create.mockResolvedValue({ id: 999 });

      await service.handleTextMessage(linkAwaitingCategory, '2', 7);

      expect(mockCommentsService.create).toHaveBeenCalledWith(
        100,
        { content: 'my retro comment', type: 'KEEP', categoryId: 2 },
        42
      );
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { pendingCommentContent: null, pendingCommentType: null } })
      );
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('נשמר'));
    });

    it('creates the comment with categoryId undefined when the user answers "דלג" (skip)', async () => {
      const linkAwaitingCategory = {
        ...linkWithContext,
        pendingCommentContent: 'my retro comment',
        pendingCommentType: 'IMPROVE' as const,
      };
      seedLink(linkAwaitingCategory);
      mockCommentsService.create.mockResolvedValue({ id: 1000 });

      await service.handleTextMessage(linkAwaitingCategory, 'דלג', 7);

      expect(mockCommentsService.create).toHaveBeenCalledWith(
        100,
        { content: 'my retro comment', type: 'IMPROVE', categoryId: undefined },
        42
      );
      expect(mockTeamCategoriesService.listCategories).not.toHaveBeenCalled();
    });

    it('re-shows the category list on an unrecognized category answer, without creating a comment', async () => {
      const linkAwaitingCategory = {
        ...linkWithContext,
        pendingCommentContent: 'my retro comment',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkAwaitingCategory);
      mockTeamCategoriesService.listCategories.mockResolvedValue([{ id: 1, label: 'תקשורת' }]);

      await service.handleTextMessage(linkAwaitingCategory, 'not a real category', 7);

      expect(mockCommentsService.create).not.toHaveBeenCalled();
      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('תקשורת'), expect.anything());
    });

    it('sends a clear error and keeps the pending state when comment creation fails (e.g. category disabled mid-flow)', async () => {
      const linkAwaitingCategory = {
        ...linkWithContext,
        pendingCommentContent: 'my retro comment',
        pendingCommentType: 'KEEP' as const,
      };
      seedLink(linkAwaitingCategory);
      mockCommentsService.create.mockRejectedValue(new Error('הקטגוריה שנבחרה לא נמצאה עבור צוות זה'));

      await service.handleTextMessage(linkAwaitingCategory, 'דלג', 7);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('לא נשמר'));
      // Pending state must NOT be cleared on failure — only lastProcessedUpdateId is updated.
      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { lastProcessedUpdateId: 7 } });
      expect(mockPrisma.userMessagingLink.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pendingCommentContent: null }) })
      );
    });
  });

  describe('handleTextMessage — idempotency bookkeeping', () => {
    it('always marks the update processed, even when the message was rejected/errored', async () => {
      setupTeamsAndSprints([], {});

      await service.handleTextMessage(baseLink, 'anything', 42);

      expect(mockPrisma.userMessagingLink.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { lastProcessedUpdateId: 42 } });
    });
  });

  describe('/start', () => {
    it('sends the welcome/help message and does nothing else', async () => {
      await service.handleTextMessage(baseLink, '/start', 1);

      expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith('555', expect.stringContaining('Navet Retro'));
      expect(mockPrisma.teamMember.findMany).not.toHaveBeenCalled();
    });
  });
});
