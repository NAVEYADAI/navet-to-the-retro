import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma.service';

describe('OnboardingService', () => {
  let service: OnboardingService;

  const now = new Date('2026-10-20T12:00:00Z');

  const prisma = {
    teamMember: { findMany: jest.fn(), count: jest.fn() },
    userOnboardingState: { findUnique: jest.fn(), upsert: jest.fn() },
    comment: { count: jest.fn() },
    userMessagingLink: { count: jest.fn() },
    teamInvite: { count: jest.fn() },
    sprint: { count: jest.fn(), findFirst: jest.fn() },
    focusPoint: { count: jest.fn() },
  };

  const activeTeam = { status: 'ACTIVE', deletedAt: null };
  const asMember = (teamId: number, over: Partial<{ role: string; isAdmin: boolean; team: object }> = {}) => ({
    teamId,
    role: 'DEVELOPER',
    isAdmin: false,
    status: 'ACTIVE',
    team: activeTeam,
    ...over,
  });
  const asLead = (teamId: number) => asMember(teamId, { role: 'TEAM_LEADER' });
  const asAdmin = (teamId: number) => asMember(teamId, { isAdmin: true });

  // Defaults: nothing done anywhere.
  function setup({
    memberships = [] as unknown[],
    state = null as unknown,
    comments = 0,
    telegram = 0,
    invites = 0,
    otherMembers = 0,
    sprints = 0,
    endedSprints = 0,
    focusPoints = 0,
    activeSprintId = null as number | null,
    endedSprintId = null as number | null,
  } = {}) {
    prisma.teamMember.findMany.mockResolvedValue(memberships);
    prisma.userOnboardingState.findUnique.mockResolvedValue(state);
    prisma.comment.count.mockResolvedValue(comments);
    prisma.userMessagingLink.count.mockResolvedValue(telegram);
    prisma.teamInvite.count.mockResolvedValue(invites);
    prisma.teamMember.count.mockResolvedValue(otherMembers);
    // open-sprint then close-sprint count (called in that order inside Promise.all)
    prisma.sprint.count.mockResolvedValue(sprints); // any further count (the guide check) sees the same total
    prisma.sprint.count.mockResolvedValueOnce(sprints).mockResolvedValueOnce(endedSprints);
    prisma.focusPoint.count.mockResolvedValue(focusPoints);
    // hints: the running sprint (endDate gte) and the latest finished one (endDate lt) are separate lookups
    prisma.sprint.findFirst.mockImplementation(async ({ where }: { where: { endDate: { lt?: Date } } }) => {
      const id = where.endDate.lt ? endedSprintId : activeSprintId;
      return id === null ? null : { id };
    });
  }

  const doneMap = (steps: { key: string; done: boolean }[]) =>
    Object.fromEntries(steps.map((s) => [s.key, s.done]));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OnboardingService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getStatus - track', () => {
    it('no team at all -> MANAGEMENT track, nothing done', async () => {
      setup();
      const res = await service.getStatus(1, now);
      expect(res.track).toBe('MANAGEMENT');
      expect(res.steps.map((s) => s.key)).toEqual([
        'create-team', 'invite-member', 'open-sprint', 'close-sprint', 'pick-focus-point',
      ]);
      expect(res.steps.every((s) => !s.done)).toBe(true);
      expect(res.checklistComplete).toBe(false);
      // No team means no team-scoped queries at all.
      expect(prisma.sprint.count).not.toHaveBeenCalled();
      expect(prisma.teamInvite.count).not.toHaveBeenCalled();
    });

    it('regular member of an active team -> MEMBER track', async () => {
      setup({ memberships: [asMember(5)] });
      const res = await service.getStatus(1, now);
      expect(res.track).toBe('MEMBER');
      expect(res.steps.map((s) => s.key)).toEqual(['join-team', 'first-comment', 'connect-telegram']);
    });

    it('team admin -> MANAGEMENT track', async () => {
      setup({ memberships: [asAdmin(5)] });
      expect((await service.getStatus(1, now)).track).toBe('MANAGEMENT');
    });

    it('TEAM_LEADER (not admin) -> MANAGEMENT track', async () => {
      setup({ memberships: [asLead(5)] });
      expect((await service.getStatus(1, now)).track).toBe('MANAGEMENT');
    });

    it('mixed: member in one team, leader in another -> MANAGEMENT, scoped to the first management team', async () => {
      setup({ memberships: [asMember(1), asLead(2), asAdmin(3)], sprints: 1 });
      const res = await service.getStatus(1, now);
      expect(res.track).toBe('MANAGEMENT');
      expect(prisma.sprint.count).toHaveBeenCalledWith({ where: { teamId: 2, deletedAt: null } });
      expect(doneMap(res.steps)['open-sprint']).toBe(true);
    });

    it('only a team still awaiting approval -> no active team, MANAGEMENT with create-team undone', async () => {
      setup({ memberships: [asAdmin(9)].map((m) => ({ ...m, team: { status: 'PENDING_APPROVAL', deletedAt: null } })) });
      const res = await service.getStatus(1, now);
      expect(res.track).toBe('MANAGEMENT');
      expect(doneMap(res.steps)['create-team']).toBe(false);
    });

    it('queries only ACTIVE memberships of non-deleted teams', async () => {
      setup();
      await service.getStatus(7, now);
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7, status: 'ACTIVE', team: { deletedAt: null } } })
      );
    });
  });

  describe('getStatus - hints (targets for the checklist buttons)', () => {
    it('no team: every hint is null and no sprint lookup happens', async () => {
      setup();
      const res = await service.getStatus(1, now);
      expect(res.hints).toEqual({ teamId: null, activeSprintId: null, endedSprintId: null });
      expect(prisma.sprint.findFirst).not.toHaveBeenCalled();
    });

    it('management: points at the first managed team and its running sprint', async () => {
      setup({ memberships: [asMember(3), asAdmin(5)], activeSprintId: 40, endedSprintId: 31 });
      const res = await service.getStatus(1, now);
      expect(res.hints).toEqual({ teamId: 5, activeSprintId: 40, endedSprintId: 31 });
      expect(prisma.sprint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId: 5, deletedAt: null, endDate: { gte: new Date('2026-10-20T00:00:00Z') } }),
        })
      );
    });

    it('member: points at the first active team; the running sprint may be missing', async () => {
      setup({ memberships: [asMember(8), asMember(9)], activeSprintId: 77 });
      const res = await service.getStatus(1, now);
      expect(res.track).toBe('MEMBER');
      expect(res.hints).toEqual({ teamId: 8, activeSprintId: 77, endedSprintId: null });
    });
  });

  describe('getStatus - guideAutoStart (feature 22)', () => {
    it('a brand-new user (no team, no comment, never shown) gets the guide', async () => {
      setup();
      expect((await service.getStatus(1, now)).guideAutoStart).toBe(true);
    });

    it('a user who already wrote a comment does not', async () => {
      setup({ memberships: [asMember(3)], comments: 2 });
      expect((await service.getStatus(1, now)).guideAutoStart).toBe(false);
    });

    it('a member of a team that already has a sprint does not (existing users are not surprised on deploy day)', async () => {
      setup({ memberships: [asAdmin(5)], sprints: 1 });
      expect((await service.getStatus(1, now)).guideAutoStart).toBe(false);
    });

    it('a team with no sprint yet still counts as new', async () => {
      setup({ memberships: [asAdmin(5)] });
      expect((await service.getStatus(1, now)).guideAutoStart).toBe(true);
    });

    it('once guideAutoStartedAt is set it never fires again, and no extra queries run', async () => {
      setup({ state: { guideAutoStartedAt: new Date() } });
      expect((await service.getStatus(1, now)).guideAutoStart).toBe(false);
    });
  });

  describe('markGuideStarted (feature 22)', () => {
    it('stamps the time the first time', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue(null);
      prisma.userOnboardingState.upsert.mockResolvedValue({});
      await service.markGuideStarted(1);
      expect(prisma.userOnboardingState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 }, create: { userId: 1, guideAutoStartedAt: expect.any(Date) } })
      );
    });

    it('is idempotent: a second call does not rewrite the stamp', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue({ guideAutoStartedAt: new Date() });
      await service.markGuideStarted(1);
      expect(prisma.userOnboardingState.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getStatus - management steps', () => {
    it('team without a second member, invite or sprint: only create-team done', async () => {
      setup({ memberships: [asAdmin(5)] });
      const res = await service.getStatus(1, now);
      expect(doneMap(res.steps)).toEqual({
        'create-team': true, 'invite-member': false, 'open-sprint': false,
        'close-sprint': false, 'pick-focus-point': false,
      });
    });

    it('an invite OR another real member completes invite-member', async () => {
      setup({ memberships: [asAdmin(5)], invites: 1 });
      expect(doneMap((await service.getStatus(1, now)).steps)['invite-member']).toBe(true);
      jest.resetAllMocks();
      setup({ memberships: [asAdmin(5)], otherMembers: 1 });
      expect(doneMap((await service.getStatus(1, now)).steps)['invite-member']).toBe(true);
    });

    it('does not count phantom members or the user themself as an invited member', async () => {
      setup({ memberships: [asAdmin(5)] });
      await service.getStatus(1, now);
      expect(prisma.teamMember.count).toHaveBeenCalledWith({
        where: { teamId: 5, userId: { not: 1 }, user: { isPhantom: false } },
      });
    });

    it('sprint without comments / not ended: open-sprint done, close-sprint not', async () => {
      setup({ memberships: [asAdmin(5)], sprints: 1, endedSprints: 0 });
      const d = doneMap((await service.getStatus(1, now)).steps);
      expect(d['open-sprint']).toBe(true);
      expect(d['close-sprint']).toBe(false);
    });

    it('ignores soft-deleted sprints and measures "ended" against now', async () => {
      setup({ memberships: [asAdmin(5)] });
      await service.getStatus(1, now);
      expect(prisma.sprint.count).toHaveBeenCalledWith({ where: { teamId: 5, deletedAt: null } });
      expect(prisma.sprint.count).toHaveBeenCalledWith({
        where: { teamId: 5, deletedAt: null, endDate: { lt: now } },
      });
    });

    it('everything done -> all steps done and checklistComplete', async () => {
      setup({ memberships: [asAdmin(5)], otherMembers: 2, sprints: 3, endedSprints: 2, focusPoints: 1 });
      const res = await service.getStatus(1, now);
      expect(res.steps.every((s) => s.done)).toBe(true);
      expect(res.checklistComplete).toBe(true);
    });
  });

  describe('getStatus - member steps', () => {
    it('joined, no comment yet', async () => {
      setup({ memberships: [asMember(5)] });
      const res = await service.getStatus(1, now);
      expect(doneMap(res.steps)).toEqual({ 'join-team': true, 'first-comment': false, 'connect-telegram': false });
      expect(res.checklistComplete).toBe(false);
    });

    it('comment written completes the checklist even without the optional Telegram step', async () => {
      setup({ memberships: [asMember(5)], comments: 2 });
      const res = await service.getStatus(1, now);
      expect(doneMap(res.steps)['first-comment']).toBe(true);
      expect(res.steps.find((s) => s.key === 'connect-telegram')).toMatchObject({ done: false, optional: true });
      expect(res.checklistComplete).toBe(true);
    });

    it('counts only comments in non-deleted teams/sprints and only non-revoked Telegram links', async () => {
      setup({ memberships: [asMember(5)], telegram: 1 });
      const res = await service.getStatus(4, now);
      expect(prisma.comment.count).toHaveBeenCalledWith({
        where: { authorId: 4, team: { deletedAt: null }, sprint: { deletedAt: null } },
      });
      expect(prisma.userMessagingLink.count).toHaveBeenCalledWith({
        where: { userId: 4, channel: 'TELEGRAM', isRevoked: false },
      });
      expect(doneMap(res.steps)['connect-telegram']).toBe(true);
    });
  });

  describe('getStatus - dismissed flag and "what\'s new"', () => {
    it('reports checklistDismissed from the stored state; no state row means not dismissed', async () => {
      setup({ memberships: [asMember(5)] });
      expect((await service.getStatus(1, now)).checklistDismissed).toBe(false);
      jest.resetAllMocks();
      setup({ memberships: [asMember(5)], state: { checklistDismissedAt: new Date(), seenFeatureKeys: [] } });
      expect((await service.getStatus(1, now)).checklistDismissed).toBe(true);
    });

    it('only features from 2026-10-15 onward are "new"; management-only ones need management', async () => {
      setup({ memberships: [asMember(5)] });
      expect((await service.getStatus(1, now)).unseenFeatureKeys).toEqual([]);
      jest.resetAllMocks();
      setup({ memberships: [asLead(5)] });
      expect((await service.getStatus(1, now)).unseenFeatureKeys).toEqual(['focus-points']);
    });

    it('a user with no team does not get management-only features', async () => {
      setup();
      expect((await service.getStatus(1, now)).unseenFeatureKeys).toEqual([]);
    });

    it('drops keys already seen', async () => {
      setup({ memberships: [asLead(5)], state: { checklistDismissedAt: null, seenFeatureKeys: ['focus-points'] } });
      expect((await service.getStatus(1, now)).unseenFeatureKeys).toEqual([]);
    });
  });

  describe('markFeaturesSeen', () => {
    it('creates the state row lazily with the known keys', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue(null);
      prisma.userOnboardingState.upsert.mockResolvedValue({ seenFeatureKeys: ['focus-points'] });
      const res = await service.markFeaturesSeen(1, ['focus-points']);
      expect(prisma.userOnboardingState.upsert).toHaveBeenCalledWith({
        where: { userId: 1 },
        create: { userId: 1, seenFeatureKeys: ['focus-points'] },
        update: { seenFeatureKeys: { push: ['focus-points'] } },
      });
      expect(res).toEqual({ seenFeatureKeys: ['focus-points'] });
    });

    it('is idempotent: re-sending an already-seen key writes nothing', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue({ seenFeatureKeys: ['focus-points'] });
      const res = await service.markFeaturesSeen(1, ['focus-points', 'focus-points']);
      expect(prisma.userOnboardingState.upsert).not.toHaveBeenCalled();
      expect(res).toEqual({ seenFeatureKeys: ['focus-points'] });
    });

    it('only appends keys not seen yet, de-duplicating the request', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue({ seenFeatureKeys: ['telegram'] });
      prisma.userOnboardingState.upsert.mockResolvedValue({ seenFeatureKeys: ['telegram', 'focus-points'] });
      await service.markFeaturesSeen(1, ['telegram', 'focus-points', 'focus-points']);
      expect(prisma.userOnboardingState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { seenFeatureKeys: { push: ['focus-points'] } } })
      );
    });

    it('ignores unknown keys without failing', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue({ seenFeatureKeys: [] });
      prisma.userOnboardingState.upsert.mockResolvedValue({ seenFeatureKeys: ['focus-points'] });
      await service.markFeaturesSeen(1, ['no-such-feature', 'focus-points']);
      expect(prisma.userOnboardingState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { seenFeatureKeys: { push: ['focus-points'] } } })
      );
    });

    it('only-unknown keys on a user with no row still creates the row (empty), not an error', async () => {
      prisma.userOnboardingState.findUnique.mockResolvedValue(null);
      prisma.userOnboardingState.upsert.mockResolvedValue({ seenFeatureKeys: [] });
      await expect(service.markFeaturesSeen(1, ['nope'])).resolves.toEqual({ seenFeatureKeys: [] });
    });

    it('rejects a malformed body with 400', async () => {
      await expect(service.markFeaturesSeen(1, undefined)).rejects.toThrow(BadRequestException);
      await expect(service.markFeaturesSeen(1, 'focus-points')).rejects.toThrow(BadRequestException);
      await expect(service.markFeaturesSeen(1, [1, 2])).rejects.toThrow(BadRequestException);
      await expect(service.markFeaturesSeen(1, Array(51).fill('x'))).rejects.toThrow(BadRequestException);
    });
  });

  describe('dismiss / restore checklist', () => {
    it('dismiss upserts checklistDismissedAt', async () => {
      prisma.userOnboardingState.upsert.mockResolvedValue({});
      const res = await service.dismissChecklist(3);
      const arg = prisma.userOnboardingState.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: 3 });
      expect(arg.create.checklistDismissedAt).toBeInstanceOf(Date);
      expect(arg.update.checklistDismissedAt).toBeInstanceOf(Date);
      expect(res).toEqual({ checklistDismissed: true });
    });

    it('restore resets checklistDismissedAt to null', async () => {
      prisma.userOnboardingState.upsert.mockResolvedValue({});
      const res = await service.restoreChecklist(3);
      expect(prisma.userOnboardingState.upsert).toHaveBeenCalledWith({
        where: { userId: 3 },
        create: { userId: 3, checklistDismissedAt: null },
        update: { checklistDismissedAt: null },
      });
      expect(res).toEqual({ checklistDismissed: false });
    });
  });
});
