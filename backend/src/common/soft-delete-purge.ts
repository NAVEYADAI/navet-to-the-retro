import { PrismaService } from '../prisma.service';
import { purgeCutoff } from './soft-delete';

/**
 * Feature 14 (§14.0 technical default #4): hard-deletes every soft-deleted sprint/team older than the
 * 30-day retention window. There is no scheduler in the app and the Fly machine suspends when idle,
 * so this runs on server start (`SoftDeletePurgeBootstrap`) and right before any "deleted items"
 * listing — cheap, and needs no extra infrastructure. The existing cascades (Sprint → Comment /
 * SprintGoogleEvent / SprintLengthChange, Team → TeamMember / Sprint / Comment / TeamInvite /
 * TeamCommentCategory / GoogleCalendarTeamCalendar / TeamLogo) remove everything underneath.
 *
 * Teams go first: deleting an expired team already removes its sprints, so the sprint pass only has
 * to deal with sprints that were deleted on their own.
 */
export async function purgeExpiredSoftDeleted(
  prisma: Pick<PrismaService, 'team' | 'sprint'>,
  now: Date = new Date()
): Promise<{ teams: number; sprints: number }> {
  const cutoff = purgeCutoff(now);
  const teams = await prisma.team.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  const sprints = await prisma.sprint.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  return { teams: teams.count, sprints: sprints.count };
}
