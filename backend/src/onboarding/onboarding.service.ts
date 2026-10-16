import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  OnboardingHintsDto,
  OnboardingStatusDto,
  OnboardingStepDto,
  OnboardingTrack,
} from './dto/onboarding.dto';
import { KNOWN_FEATURE_KEYS, ONBOARDING_FEATURES, WHATS_NEW_SINCE } from './onboarding-features';

const MAX_SEEN_KEYS_PER_REQUEST = 50;

// Step keys (stable identifiers the client maps to titles/links). Order = display order.
export const MEMBER_STEPS = [
  { key: 'join-team', optional: false },
  { key: 'first-comment', optional: false },
  { key: 'connect-telegram', optional: true },
] as const;

export const MANAGEMENT_STEPS = [
  { key: 'create-team', optional: false },
  { key: 'invite-member', optional: false },
  { key: 'open-sprint', optional: false },
  { key: 'close-sprint', optional: false },
  { key: 'pick-focus-point', optional: false },
] as const;

interface MembershipRow {
  teamId: number;
  role: string;
  isAdmin: boolean;
  status: string;
  team: { status: string; deletedAt: Date | null };
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // Progress is derived from existing data on every call (§21.0 default #1); the only stored state
  // is the dismissed flag + seen keys. Reading never creates the state row.
  async getStatus(userId: number, now: Date = new Date()): Promise<OnboardingStatusDto> {
    // One query for memberships (ordered so "first management team" is deterministic), one for the
    // stored UI state; everything else is a bounded number of parallel counts, not per-step N+1.
    const [memberships, state] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { userId, status: 'ACTIVE', team: { deletedAt: null } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          teamId: true,
          role: true,
          isAdmin: true,
          status: true,
          team: { select: { status: true, deletedAt: true } },
        },
      }) as Promise<MembershipRow[]>,
      this.prisma.userOnboardingState.findUnique({ where: { userId } }),
    ]);

    // Only an ACTIVE membership in a live, ACTIVE team counts as progress (a PENDING invitation, a
    // team still awaiting approval and a soft-deleted team are not progress — §21.1 filter item).
    const activeTeamMemberships = memberships.filter((m) => m.team.status === 'ACTIVE');
    // Same definition as team-permissions.util.ts::assertCanManageTeamContent.
    const managementMemberships = activeTeamMemberships.filter(
      (m) => m.isAdmin || m.role === 'TEAM_LEADER'
    );
    const firstManagementTeamId = managementMemberships[0]?.teamId ?? null;

    // §21.0 decision #10: management if management in at least one active team; a user with no
    // relevant team at all is also on the management track (their first step is creating a team).
    const track: OnboardingTrack =
      managementMemberships.length > 0 || activeTeamMemberships.length === 0 ? 'MANAGEMENT' : 'MEMBER';

    const hintTeamId =
      track === 'MANAGEMENT' ? firstManagementTeamId : (activeTeamMemberships[0]?.teamId ?? null);
    const [steps, hints] = await Promise.all([
      track === 'MANAGEMENT'
        ? this.managementSteps(userId, firstManagementTeamId, now)
        : this.memberSteps(userId, activeTeamMemberships.length > 0),
      this.getHints(hintTeamId, now),
    ]);

    const seen = new Set(state?.seenFeatureKeys ?? []);
    const canSeeManagementFeatures = managementMemberships.length > 0;
    const unseenFeatureKeys = ONBOARDING_FEATURES
      .filter((f) => f.since >= WHATS_NEW_SINCE)
      .filter((f) => f.audience !== 'MANAGEMENT' || canSeeManagementFeatures)
      .filter((f) => !seen.has(f.key))
      // Newest first; Array.prototype.sort is stable so registry order breaks ties.
      .sort((a, b) => (a.since < b.since ? 1 : a.since > b.since ? -1 : 0))
      .map((f) => f.key);

    return {
      track,
      steps,
      checklistComplete: steps.every((s) => s.optional || s.done),
      checklistDismissed: !!state?.checklistDismissedAt,
      unseenFeatureKeys,
      hints,
    };
  }

  // Targets for the checklist buttons: the team the steps refer to and its sprint running today.
  // Deleted sprints never count. (`endDate` is a date: a sprint is still running
  // through the whole of its last day, same reading as focus-point-access::sprintEndsAt.)
  private async getHints(teamId: number | null, now: Date): Promise<OnboardingHintsDto> {
    if (teamId === null) return { teamId: null, activeSprintId: null };
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const active = await this.prisma.sprint.findFirst({
      where: { teamId, deletedAt: null, startDate: { lte: now }, endDate: { gte: startOfToday } },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    return { teamId, activeSprintId: active?.id ?? null };
  }

  private async memberSteps(userId: number, joined: boolean): Promise<OnboardingStepDto[]> {
    const [commentCount, telegramCount] = await Promise.all([
      this.prisma.comment.count({
        where: { authorId: userId, team: { deletedAt: null }, sprint: { deletedAt: null } },
      }),
      this.prisma.userMessagingLink.count({
        where: { userId, channel: 'TELEGRAM', isRevoked: false },
      }),
    ]);
    const done: Record<string, boolean> = {
      'join-team': joined,
      'first-comment': commentCount > 0,
      'connect-telegram': telegramCount > 0,
    };
    return MEMBER_STEPS.map((s) => ({ key: s.key, done: done[s.key], optional: s.optional }));
  }

  private async managementSteps(
    userId: number,
    teamId: number | null,
    now: Date
  ): Promise<OnboardingStepDto[]> {
    let inviteDone = false;
    let sprintDone = false;
    let closeDone = false;
    let focusDone = false;
    if (teamId !== null) {
      const [inviteCount, otherMemberCount, sprintCount, endedSprintCount, focusPointCount] =
        await Promise.all([
          this.prisma.teamInvite.count({ where: { teamId } }),
          // Phantom members are placeholders the admin created, not someone who was invited.
          this.prisma.teamMember.count({
            where: { teamId, userId: { not: userId }, user: { isPhantom: false } },
          }),
          this.prisma.sprint.count({ where: { teamId, deletedAt: null } }),
          this.prisma.sprint.count({ where: { teamId, deletedAt: null, endDate: { lt: now } } }),
          this.prisma.focusPoint.count({ where: { teamId } }),
        ]);
      inviteDone = inviteCount > 0 || otherMemberCount > 0;
      sprintDone = sprintCount > 0;
      closeDone = endedSprintCount > 0;
      focusDone = focusPointCount > 0;
    }
    const done: Record<string, boolean> = {
      'create-team': teamId !== null,
      'invite-member': inviteDone,
      'open-sprint': sprintDone,
      'close-sprint': closeDone,
      'pick-focus-point': focusDone,
    };
    return MANAGEMENT_STEPS.map((s) => ({ key: s.key, done: done[s.key], optional: s.optional }));
  }

  async dismissChecklist(userId: number) {
    await this.prisma.userOnboardingState.upsert({
      where: { userId },
      create: { userId, checklistDismissedAt: new Date() },
      update: { checklistDismissedAt: new Date() },
    });
    return { checklistDismissed: true };
  }

  async restoreChecklist(userId: number) {
    await this.prisma.userOnboardingState.upsert({
      where: { userId },
      create: { userId, checklistDismissedAt: null },
      update: { checklistDismissedAt: null },
    });
    return { checklistDismissed: false };
  }

  // Idempotent: keys already seen are not added twice. Unknown keys are silently ignored (an old or
  // new client may know keys this server doesn't) — only a malformed body is a 400.
  async markFeaturesSeen(userId: number, keys: unknown) {
    if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) {
      throw new BadRequestException('רשימת מפתחות לא תקינה');
    }
    if (keys.length > MAX_SEEN_KEYS_PER_REQUEST) {
      throw new BadRequestException('רשימת מפתחות לא תקינה');
    }
    const known = Array.from(new Set(keys as string[])).filter((k) => KNOWN_FEATURE_KEYS.has(k));

    const existing = await this.prisma.userOnboardingState.findUnique({ where: { userId } });
    const current = existing?.seenFeatureKeys ?? [];
    const toAdd = known.filter((k) => !current.includes(k));
    if (existing && toAdd.length === 0) {
      return { seenFeatureKeys: current };
    }
    const saved = await this.prisma.userOnboardingState.upsert({
      where: { userId },
      create: { userId, seenFeatureKeys: toAdd },
      update: { seenFeatureKeys: { push: toAdd } },
    });
    return { seenFeatureKeys: saved.seenFeatureKeys };
  }
}
