import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { assertValidLogoFile, parseAccentHue } from './team-logo.util';
import { isDeleted } from '../common/soft-delete';

// Feature 19 (product-backlog/19-team-logo.md). Kept out of TeamsService, which is already large.
// A soft-deleted team (feature 14) is 404 in every method here (§19.0 decision #13): the `Cascade` on
// TeamLogo only fires on the eventual purge, so the logo bytes outlive the soft delete.
@Injectable()
export class TeamLogoService {
  constructor(private readonly prisma: PrismaService) {}

  // Same gate as TeamsService.updateTeam: 404 -> 403 (not an ACTIVE admin) -> 409 (still pending
  // approval, BUG-36: the approval e-mail already went out with the original details).
  private async assertCanEditLogo(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || isDeleted(team)) {
      throw new NotFoundException('Team not found');
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership || membership.status !== 'ACTIVE' || !membership.isAdmin) {
      throw new ForbiddenException('Only team admins can edit team details');
    }
    if (team.status !== 'ACTIVE') {
      throw new ConflictException('לא ניתן לערוך צוות שטרם אושר');
    }
    return team;
  }

  async setLogo(
    teamId: number,
    requesterId: number,
    file: { buffer?: Buffer; size?: number } | undefined,
    rawAccentHue: unknown
  ) {
    await this.assertCanEditLogo(teamId, requesterId);
    const { buffer, contentType } = assertValidLogoFile(file);
    const accentHue = parseAccentHue(rawAccentHue);
    const now = new Date();
    // Prisma's `Bytes` wants a plain Uint8Array<ArrayBuffer>, not a Node Buffer.
    const bytes = new Uint8Array(buffer);

    const [, team] = await this.prisma.$transaction([
      this.prisma.teamLogo.upsert({
        where: { teamId },
        create: { teamId, data: bytes, contentType },
        update: { data: bytes, contentType }
      }),
      this.prisma.team.update({
        where: { id: teamId },
        data: { logoUpdatedAt: now, accentHue }
      })
    ]);
    return { logoUpdatedAt: team.logoUpdatedAt, accentHue: team.accentHue };
  }

  // Idempotent: removing a logo that isn't there is a no-op, not a 404. The team colour was
  // derived from the logo, so it goes with it.
  async removeLogo(teamId: number, requesterId: number) {
    await this.assertCanEditLogo(teamId, requesterId);
    await this.prisma.$transaction([
      this.prisma.teamLogo.deleteMany({ where: { teamId } }),
      this.prisma.team.update({ where: { id: teamId }, data: { logoUpdatedAt: null, accentHue: null } })
    ]);
    return { logoUpdatedAt: null, accentHue: null };
  }

  // Change (or clear) just the team colour, without re-uploading the logo.
  async setAccent(teamId: number, requesterId: number, rawAccentHue: unknown) {
    await this.assertCanEditLogo(teamId, requesterId);
    const accentHue = parseAccentHue(rawAccentHue);
    const team = await this.prisma.team.update({ where: { id: teamId }, data: { accentHue } });
    return { logoUpdatedAt: team.logoUpdatedAt, accentHue: team.accentHue };
  }

  // ACTIVE and PENDING members both see the logo (§19.0 decision #9: an invited member already
  // sees the team's name).
  async getLogo(teamId: number, requesterId: number) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true, deletedAt: true } });
    if (!team || isDeleted(team)) {
      throw new NotFoundException('Team not found');
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } }
    });
    if (!membership) {
      throw new ForbiddenException('You do not belong to this team');
    }
    const logo = await this.prisma.teamLogo.findUnique({ where: { teamId } });
    if (!logo) {
      throw new NotFoundException('Logo not found');
    }
    return { data: Buffer.from(logo.data), contentType: logo.contentType };
  }
}
