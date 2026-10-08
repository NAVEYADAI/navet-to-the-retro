import { Injectable, ConflictException, NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TelegramLoginPayloadDto } from './dto/telegram.dto';
import { verifyTelegramLoginHash, isTelegramAuthDateFresh } from './telegram-auth.util';

// Feature 10 (telegram comment ingestion, product-backlog/10-telegram-comment-ingestion.md
// §10.0/§10.1): personal connection to an external identity, built on the same soft-revoke shape
// as GoogleCalendarConnection ("copy the closest existing per-user external-connection pattern",
// backend/AGENTS.md's per-team-owned-entities note is the closer-in-spirit analogue even though
// this isn't team-scoped).
@Injectable()
export class TelegramLinkService {
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;

  constructor(private readonly prisma: PrismaService) {}

  private assertConfigured() {
    if (!this.botToken) {
      throw new InternalServerErrorException('שילוב טלגרם אינו מוגדר כרגע בשרת');
    }
  }

  /**
   * Verifies the Telegram Login Widget payload and links (or re-links) the given Telegram account
   * to the requesting user. `upsert` on the (channel, externalId) unique pair — a user re-linking
   * the same Telegram account (e.g. after a soft-disconnect) reuses the same row instead of piling
   * up revoked duplicates.
   */
  async link(requesterId: number, dto: TelegramLoginPayloadDto) {
    this.assertConfigured();

    if (!verifyTelegramLoginHash(dto, this.botToken!)) {
      throw new UnauthorizedException('חתימת טלגרם אינה תקינה');
    }
    if (!isTelegramAuthDateFresh(dto.auth_date)) {
      throw new UnauthorizedException('קישור הטלגרם ישן מדי, נסו שוב');
    }

    const externalId = String(dto.id);
    const existing = await this.prisma.userMessagingLink.findUnique({
      where: { channel_externalId: { channel: 'TELEGRAM', externalId } }
    });

    if (existing && !existing.isRevoked && existing.userId !== requesterId) {
      throw new ConflictException('חשבון הטלגרם הזה כבר מקושר למשתמש אחר');
    }

    // BUG-49: at most one active TELEGRAM link per user — linking a different Telegram account
    // revokes the user's other active links (otherwise both chats could post comments as this user
    // and a single unlink would leave the other one live). The revoke and the upsert run in one
    // transaction so a failed upsert never leaves the user with no link at all.
    const [, link] = await this.prisma.$transaction([
      this.prisma.userMessagingLink.updateMany({
        where: { channel: 'TELEGRAM', userId: requesterId, isRevoked: false, externalId: { not: externalId } },
        data: { isRevoked: true }
      }),
      this.prisma.userMessagingLink.upsert({
        where: { channel_externalId: { channel: 'TELEGRAM', externalId } },
        update: { userId: requesterId, isRevoked: false },
        create: { channel: 'TELEGRAM', externalId, userId: requesterId, isRevoked: false }
      })
    ]);
    return link;
  }

  /** Soft-disconnect (§10.0 default #6) — never a hard delete, mirrors GoogleCalendarConnection. */
  async unlink(requesterId: number) {
    // BUG-49: revoke EVERY active link of this user (legacy data may already hold more than one),
    // not just the first one found.
    const { count } = await this.prisma.userMessagingLink.updateMany({
      where: { channel: 'TELEGRAM', userId: requesterId, isRevoked: false },
      data: { isRevoked: true }
    });
    if (count === 0) {
      throw new NotFoundException('אין חיבור טלגרם פעיל');
    }
    return { connected: false as const, revokedCount: count };
  }

  /** Current connection status for the given user — used by the settings-screen card. */
  async getStatus(requesterId: number) {
    const link = await this.prisma.userMessagingLink.findFirst({
      where: { channel: 'TELEGRAM', userId: requesterId, isRevoked: false }
    });
    return link ? { connected: true as const } : { connected: false as const };
  }
}
