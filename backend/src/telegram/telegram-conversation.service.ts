import { Injectable, Logger } from '@nestjs/common';
import { CommentType, UserMessagingLink, MessagingChannel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TelegramApiService } from './telegram-api.service';
import { CommentsService } from '../comments/comments.service';
import { TeamCategoriesService } from '../team-categories/team-categories.service';
import {
  SWITCH_TEAM_COMMAND,
  SKIP_CATEGORY_COMMAND,
  CANCEL_COMMAND,
  BACK_COMMAND,
  START_MESSAGE,
  NO_OPEN_TEAM_MESSAGE,
  ASK_KEEP_OR_IMPROVE_MESSAGE,
  ASK_KEEP_OR_IMPROVE_RETRY_MESSAGE,
  CREATE_FAILED_MESSAGE,
  CANCELLED_MESSAGE,
  NOTHING_TO_CANCEL_MESSAGE,
  BACK_TO_CONTENT_MESSAGE,
  NOTHING_TO_GO_BACK_MESSAGE,
  teamSelectedMessage,
  buildTeamListMessage,
  teamListKeyboard,
  buildSprintListMessage,
  sprintListKeyboard,
  sprintSelectedMessage,
  askTypeMessage,
  buildCategoryListMessage,
  keepImproveKeyboard,
  categoryKeyboard,
  confirmationMessage
} from './telegram-messages';

interface TeamCandidate {
  teamId: number;
  teamName: string;
}

interface SprintCandidate {
  sprintId: number;
  sprintName: string;
}

// The channel-agnostic "resolve + conversation state machine" at the heart of feature 10
// (product-backlog/10-telegram-comment-ingestion.md §10.0 decision #2 / §10.1). Everything here
// operates on the generic `UserMessagingLink` shape (`channel` + `externalId`), not on any
// Telegram-specific payload field — a future WhatsApp adapter would call these exact same public
// methods with `channel: 'WHATSAPP'`. Only `TelegramWebhookController`/`TelegramAdapterService`
// know about raw Telegram update shapes; everything below them is generic.
//
// Context resolution is now a two-stage cascade — team, then sprint (Nave's explicit ask,
// 2026-09-27, §10.0 decision #5 addendum) — each stage silently auto-resolves when there's exactly
// one open candidate UNLESS `awaitingContextConfirm` is set (only true right after an explicit
// "↩️ חזור" from the Keep/Improve stage — see the back-command handling in `processText`), in which
// case even a single candidate is presented through the same list/keyboard mechanism so the user
// can explicitly confirm or change it. The very first free-text message is held as
// `pendingCommentContent` across both stages so picking a team/sprint never requires re-typing the
// note (only the FIRST such message is trusted — a second, still-unmatched attempt never overwrites
// an already-held draft).
@Injectable()
export class TelegramConversationService {
  private readonly logger = new Logger(TelegramConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramApi: TelegramApiService,
    private readonly commentsService: CommentsService,
    private readonly teamCategoriesService: TeamCategoriesService
  ) {}

  /** Step 1 of the resolve algorithm — active (non-revoked) link for this channel identity, or null. */
  async findActiveLink(channel: MessagingChannel, externalId: string): Promise<UserMessagingLink | null> {
    const link = await this.prisma.userMessagingLink.findUnique({
      where: { channel_externalId: { channel, externalId } }
    });
    return link && !link.isRevoked ? link : null;
  }

  /**
   * §10.0 default #9 — an update whose id is <= the last one already processed for this link is a
   * Telegram retry (most likely after a Fly suspend/resume), not a new message; the caller must
   * treat it as a no-op and must NOT reply again.
   */
  isDuplicateUpdate(link: UserMessagingLink, updateId: number): boolean {
    return link.lastProcessedUpdateId != null && updateId <= link.lastProcessedUpdateId;
  }

  async markProcessed(linkId: number, updateId: number): Promise<void> {
    await this.prisma.userMessagingLink.update({
      where: { id: linkId },
      data: { lastProcessedUpdateId: updateId }
    });
  }

  /**
   * Entry point for every real text message from an already-resolved, non-duplicate link. Runs
   * the state machine (§10.1, resolve service steps 2-7) and, in every case (success, rejection,
   * or error), records `updateId` as processed — per step 7's "in every case" idempotency note.
   */
  async handleTextMessage(link: UserMessagingLink, text: string, updateId: number): Promise<void> {
    try {
      await this.processText(link, text);
    } catch (err) {
      this.logger.warn(`Failed processing Telegram text message for link ${link.id}`, err instanceof Error ? err.stack : err);
    } finally {
      await this.markProcessed(link.id, updateId);
    }
  }

  private async processText(link: UserMessagingLink, rawText: string): Promise<void> {
    const text = rawText.trim();

    if (text === '/start') {
      await this.telegramApi.sendMessage(link.externalId, START_MESSAGE);
      return;
    }

    // §10.0 decision #5 — available at any step, clears both the active context and any pending
    // comment, then goes straight back to team resolution.
    if (this.isSwitchTeamCommand(text)) {
      const cleared = await this.clearContext(link.id);
      await this.resolveContext(cleared, text);
      return;
    }

    // Cancel — available at every step of entering a comment (Keep/Improve, category), unlike
    // "switch team" this only drops the in-progress comment and keeps the active team/sprint
    // context, so the next free-text message starts a fresh comment in the same team/sprint.
    if (this.isCancelCommand(text)) {
      if (link.pendingCommentContent == null && link.pendingCommentType == null) {
        await this.telegramApi.sendMessage(link.externalId, NOTHING_TO_CANCEL_MESSAGE);
      } else {
        await this.prisma.userMessagingLink.update({
          where: { id: link.id },
          data: { pendingCommentContent: null, pendingCommentType: null }
        });
        await this.telegramApi.sendMessage(link.externalId, CANCELLED_MESSAGE);
      }
      return;
    }

    // Back — steps back exactly one stage instead of discarding everything (unlike cancel):
    // category → re-ask Keep/Improve (keeps the note); Keep/Improve → re-ask team/sprint (keeps
    // the note, forces an explicit confirm even for a single team/sprint via `awaitingContextConfirm`).
    if (this.isBackCommand(text)) {
      if (link.pendingCommentType != null) {
        await this.prisma.userMessagingLink.update({
          where: { id: link.id },
          data: { pendingCommentType: null }
        });
        await this.telegramApi.sendMessage(link.externalId, ASK_KEEP_OR_IMPROVE_MESSAGE, keepImproveKeyboard());
      } else if (link.pendingCommentContent != null && link.activeTeamId != null) {
        const reverted = await this.prisma.userMessagingLink.update({
          where: { id: link.id },
          data: { activeTeamId: null, activeSprintId: null, contextSetAt: null, awaitingContextConfirm: true }
        });
        await this.resolveContext(reverted, text);
      } else {
        await this.telegramApi.sendMessage(link.externalId, NOTHING_TO_GO_BACK_MESSAGE);
      }
      return;
    }

    // Step 2 — an already-active context must still be valid (member still ACTIVE, sprint still
    // in range, and not time-expired) on every message, not just once.
    if (link.activeTeamId != null && link.activeSprintId != null) {
      const stillOpen = await this.isContextStillOpen(link);
      if (!stillOpen) {
        link = await this.clearContext(link.id);
      }
    }

    // Steps 3/4 — team and/or sprint not yet resolved: cascade through both stages.
    if (link.activeTeamId == null || link.activeSprintId == null) {
      const resolution = await this.resolveContext(link, text);
      if (!resolution) return; // a message was already sent (no open team, or a candidate list)
      if (resolution.consumedAsAnswer) return; // `text` was a team/sprint selection answer itself
      link = resolution.link; // silent resolve — `text` still needs handling below
    }

    // Step 6 — awaiting a category answer (or "skip").
    if (link.pendingCommentType != null) {
      await this.handleCategoryAnswer(link, text);
      return;
    }

    // Step 5 (second half) — awaiting a Keep/Improve answer.
    if (link.pendingCommentContent != null) {
      await this.handleTypeAnswer(link, text);
      return;
    }

    // Step 5 (first half) — fresh free-text message with a fully resolved context: start a new
    // pending comment and ask Keep/Improve, with a team/sprint recap (Nave's explicit ask).
    await this.prisma.userMessagingLink.update({
      where: { id: link.id },
      data: { pendingCommentContent: text }
    });
    const { teamName, sprintName } = await this.getTeamAndSprintNames(link.activeTeamId!, link.activeSprintId!);
    await this.telegramApi.sendMessage(link.externalId, askTypeMessage(teamName, sprintName), keepImproveKeyboard());
  }

  private isSwitchTeamCommand(text: string): boolean {
    return text === SWITCH_TEAM_COMMAND || text.includes('החלף צוות');
  }

  private isCancelCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === CANCEL_COMMAND.toLowerCase() || normalized === 'cancel' || normalized.includes('מחק') || normalized.includes('ביטול');
  }

  private isBackCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === BACK_COMMAND.toLowerCase() || normalized === 'back' || normalized.includes('חזור');
  }

  private isSkipCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === SKIP_CATEGORY_COMMAND.toLowerCase() || normalized === 'דלג' || normalized === 'skip';
  }

  private async clearContext(linkId: number): Promise<UserMessagingLink> {
    return this.prisma.userMessagingLink.update({
      where: { id: linkId },
      data: {
        activeTeamId: null,
        activeSprintId: null,
        pendingCommentContent: null,
        pendingCommentType: null,
        contextSetAt: null,
        awaitingContextConfirm: false
      }
    });
  }

  /**
   * §10.0 default #5 — server-side redefinition of "open sprint" (no such concept exists in the
   * DB): `TeamMember.status === 'ACTIVE'` + `sprint.startDate <= now <= sprint.endDate`. Mirrors
   * the client-side-only `getSprintState` in sprint-list-web.tsx, which has no backend equivalent
   * to reuse. Returns only the TEAM candidates — sprint candidates are resolved separately per
   * team (see `getOpenSprintsForTeam`), since a team can in principle have more than one sprint
   * open at once (not enforced anywhere in the schema).
   */
  private async getOpenTeamCandidates(userId: number): Promise<TeamCandidate[]> {
    const now = new Date();
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { teamId: true, team: { select: { name: true } } }
    });
    if (memberships.length === 0) return [];

    const openSprints = await this.prisma.sprint.findMany({
      where: {
        teamId: { in: memberships.map((m) => m.teamId) },
        startDate: { lte: now },
        endDate: { gte: now }
      },
      select: { teamId: true }
    });
    const teamIdsWithOpenSprint = new Set(openSprints.map((s) => s.teamId));

    return memberships
      .filter((m) => teamIdsWithOpenSprint.has(m.teamId))
      .map((m) => ({ teamId: m.teamId, teamName: m.team.name }));
  }

  private async getOpenSprintsForTeam(teamId: number): Promise<SprintCandidate[]> {
    const now = new Date();
    const sprints = await this.prisma.sprint.findMany({
      where: { teamId, startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, name: true },
      orderBy: { startDate: 'asc' }
    });
    return sprints.map((s) => ({ sprintId: s.id, sprintName: s.name }));
  }

  /**
   * Validates an already-resolved context is still usable: membership still ACTIVE, sprint still
   * in its date range, and — new, per Nave's explicit ask reversing the earlier "no time-based
   * expiry" decision — not older than `contextStickyHours` (per-link, user-configurable, null =
   * never expire). A passive expiry here is silent (does not set `awaitingContextConfirm`) — it
   * simply re-runs the normal resolve flow, which is silent again if there's still only one team.
   */
  private async isContextStillOpen(link: UserMessagingLink): Promise<boolean> {
    const now = new Date();
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: link.userId, teamId: link.activeTeamId! } }
    });
    if (!membership || membership.status !== 'ACTIVE') return false;

    const sprint = await this.prisma.sprint.findUnique({ where: { id: link.activeSprintId! } });
    if (!sprint || sprint.teamId !== link.activeTeamId) return false;
    if (sprint.startDate.getTime() > now.getTime() || sprint.endDate.getTime() < now.getTime()) return false;

    if (link.contextStickyHours != null && link.contextSetAt != null) {
      const ageMs = now.getTime() - link.contextSetAt.getTime();
      if (ageMs > link.contextStickyHours * 60 * 60 * 1000) return false;
    }

    return true;
  }

  private matchByLabel<T>(candidates: T[], text: string, label: (c: T) => string): T | null {
    const trimmed = text.trim();
    const asIndex = parseInt(trimmed, 10);
    if (!isNaN(asIndex) && asIndex >= 1 && asIndex <= candidates.length) {
      return candidates[asIndex - 1];
    }
    return candidates.find((c) => label(c).trim().toLowerCase() === trimmed.toLowerCase()) ?? null;
  }

  private async getTeamName(teamId: number): Promise<string> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    return team?.name ?? '';
  }

  private async getTeamAndSprintNames(teamId: number, sprintId: number): Promise<{ teamName: string; sprintName: string }> {
    const [team, sprint] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
      this.prisma.sprint.findUnique({ where: { id: sprintId }, select: { name: true } })
    ]);
    return { teamName: team?.name ?? '', sprintName: sprint?.name ?? '' };
  }

  /**
   * Steps 3/4 of the resolve algorithm, team stage. Returns `null` when a message was already sent
   * and the caller should stop (no open team at all, or a candidate list/prompt was just (re)sent
   * awaiting a reply). Otherwise cascades into `resolveSprintStage` — either because the team was
   * already resolved, or because it just silently resolved to the only candidate.
   */
  private async resolveContext(
    link: UserMessagingLink,
    text: string
  ): Promise<{ link: UserMessagingLink; consumedAsAnswer: boolean } | null> {
    if (link.activeTeamId == null) {
      const teams = await this.getOpenTeamCandidates(link.userId);

      if (teams.length === 0) {
        await this.telegramApi.sendMessage(link.externalId, NO_OPEN_TEAM_MESSAGE);
        return null;
      }

      if (teams.length === 1 && !link.awaitingContextConfirm) {
        link = await this.prisma.userMessagingLink.update({
          where: { id: link.id },
          data: { activeTeamId: teams[0].teamId, contextSetAt: new Date() }
        });
        // falls through to the sprint stage below, `text` not consumed
      } else {
        const match = this.matchByLabel(teams, text, (t) => t.teamName);
        if (match) {
          link = await this.prisma.userMessagingLink.update({
            where: { id: link.id },
            data: { activeTeamId: match.teamId, contextSetAt: new Date(), awaitingContextConfirm: false }
          });
          await this.telegramApi.sendMessage(link.externalId, teamSelectedMessage(match.teamName));
          // Team just explicitly confirmed — cascade into sprint resolution with an empty answer
          // (the consumed pick-text must never accidentally match a sprint by coincidence). The
          // original `text` was consumed by this pick regardless of what happens next, so
          // `consumedAsAnswer` is always true here — even if the sprint stage below silently
          // resolves a single sprint with no held draft (which by itself would report `false`,
          // meaning "safe to reinterpret the input" — but that input was this pick, not fresh text).
          const sprintResult = await this.resolveSprintStage(link, '');
          if (!sprintResult) return null;
          return { link: sprintResult.link, consumedAsAnswer: true };
        }

        if (link.pendingCommentContent == null) {
          link = await this.prisma.userMessagingLink.update({
            where: { id: link.id },
            data: { pendingCommentContent: text }
          });
        }
        await this.telegramApi.sendMessage(link.externalId, buildTeamListMessage(teams), teamListKeyboard(teams));
        return null;
      }
    }

    return this.resolveSprintStage(link, text);
  }

  /**
   * Steps 3/4 of the resolve algorithm, sprint stage — same shape/mechanism as the team stage.
   * Unlike the team stage, this one always silently resolves a single candidate regardless of
   * `awaitingContextConfirm` — Nave's explicit "↩️ חזור" ask was specifically about re-confirming
   * the TEAM, not adding a second confirmation for the (usually singular) sprint underneath it.
   */
  private async resolveSprintStage(
    link: UserMessagingLink,
    text: string
  ): Promise<{ link: UserMessagingLink; consumedAsAnswer: boolean } | null> {
    if (link.activeSprintId != null) {
      return { link, consumedAsAnswer: false };
    }

    const sprints = await this.getOpenSprintsForTeam(link.activeTeamId!);

    if (sprints.length === 0) {
      // The team no longer has an open sprint (rare race) — reset and report as no-open-team.
      link = await this.clearContext(link.id);
      await this.telegramApi.sendMessage(link.externalId, NO_OPEN_TEAM_MESSAGE);
      return null;
    }

    if (sprints.length === 1) {
      const updated = await this.prisma.userMessagingLink.update({
        where: { id: link.id },
        data: { activeSprintId: sprints[0].sprintId, contextSetAt: new Date() }
      });
      if (updated.pendingCommentContent != null) {
        const teamName = await this.getTeamName(updated.activeTeamId!);
        await this.telegramApi.sendMessage(
          updated.externalId,
          askTypeMessage(teamName, sprints[0].sprintName),
          keepImproveKeyboard()
        );
        return { link: updated, consumedAsAnswer: true };
      }
      return { link: updated, consumedAsAnswer: false };
    }

    const match = this.matchByLabel(sprints, text, (s) => s.sprintName);
    if (match) {
      const updated = await this.prisma.userMessagingLink.update({
        where: { id: link.id },
        data: { activeSprintId: match.sprintId, contextSetAt: new Date(), awaitingContextConfirm: false }
      });
      await this.telegramApi.sendMessage(updated.externalId, sprintSelectedMessage(match.sprintName));
      if (updated.pendingCommentContent != null) {
        const teamName = await this.getTeamName(updated.activeTeamId!);
        await this.telegramApi.sendMessage(updated.externalId, askTypeMessage(teamName, match.sprintName), keepImproveKeyboard());
      }
      return { link: updated, consumedAsAnswer: true };
    }

    if (link.pendingCommentContent == null) {
      link = await this.prisma.userMessagingLink.update({
        where: { id: link.id },
        data: { pendingCommentContent: text }
      });
    }
    await this.telegramApi.sendMessage(link.externalId, buildSprintListMessage(sprints), sprintListKeyboard(sprints));
    return null;
  }

  /** Step 5 (second question) — a reply to "שימור או שיפור?". */
  private async handleTypeAnswer(link: UserMessagingLink, text: string): Promise<void> {
    const type = this.parseCommentType(text);
    if (!type) {
      await this.telegramApi.sendMessage(link.externalId, ASK_KEEP_OR_IMPROVE_RETRY_MESSAGE, keepImproveKeyboard());
      return;
    }

    await this.prisma.userMessagingLink.update({
      where: { id: link.id },
      data: { pendingCommentType: type }
    });

    const categories = await this.teamCategoriesService.listCategories(link.activeTeamId!, link.userId, true);
    await this.telegramApi.sendMessage(link.externalId, buildCategoryListMessage(categories), categoryKeyboard(categories));
  }

  private parseCommentType(text: string): CommentType | null {
    const normalized = text.trim().toLowerCase();
    if (normalized === 'keep' || normalized.includes('שימור')) return CommentType.KEEP;
    if (normalized === 'improve' || normalized.includes('שיפור')) return CommentType.IMPROVE;
    return null;
  }

  /** Step 6 — a reply to the category list ("skip" is a valid choice, per §10.0 decision #6). */
  private async handleCategoryAnswer(link: UserMessagingLink, text: string): Promise<void> {
    if (this.isSkipCommand(text)) {
      await this.createPendingComment(link, undefined);
      return;
    }

    const categories = await this.teamCategoriesService.listCategories(link.activeTeamId!, link.userId, true);
    const trimmed = text.trim();
    const asIndex = parseInt(trimmed, 10);
    const match =
      (!isNaN(asIndex) && asIndex >= 1 && asIndex <= categories.length ? categories[asIndex - 1] : undefined) ??
      categories.find((c: { label: string }) => c.label.trim().toLowerCase() === trimmed.toLowerCase());

    if (!match) {
      await this.telegramApi.sendMessage(link.externalId, buildCategoryListMessage(categories), categoryKeyboard(categories));
      return;
    }

    await this.createPendingComment(link, match.id);
  }

  /**
   * Step 7 — creates the comment through the existing `CommentsService.create` (never a parallel
   * write path, §10.0 decision #3). On failure (e.g. the category was disabled in the meantime),
   * the pending state is deliberately left untouched so the user can just try again.
   */
  private async createPendingComment(link: UserMessagingLink, categoryId: number | undefined): Promise<void> {
    try {
      await this.commentsService.create(
        link.activeSprintId!,
        {
          content: link.pendingCommentContent!,
          type: link.pendingCommentType!,
          categoryId
        },
        link.userId
      );
    } catch (err) {
      this.logger.warn(`Failed to create comment from Telegram link ${link.id}`, err instanceof Error ? err.stack : err);
      await this.telegramApi.sendMessage(link.externalId, CREATE_FAILED_MESSAGE);
      return;
    }

    const sprint = await this.prisma.sprint.findUnique({ where: { id: link.activeSprintId! } });
    await this.prisma.userMessagingLink.update({
      where: { id: link.id },
      data: { pendingCommentContent: null, pendingCommentType: null }
    });
    await this.telegramApi.sendMessage(
      link.externalId,
      confirmationMessage(sprint?.name ?? `#${link.activeSprintId}`, link.pendingCommentType!)
    );
  }
}
