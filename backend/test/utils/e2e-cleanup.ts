import { PrismaService } from '../../src/prisma.service';
import { assertTestDatabase } from './require-test-db';

/**
 * Tracks exactly the rows an e2e spec creates and deletes exactly those rows
 * afterward, so nothing an e2e run creates is left behind in the test DB.
 *
 * Order matters: Team.creator cascades on delete (deleting a user deletes any
 * team they created) but Team.pendingApprover only SetNulls, which would
 * orphan a team if a tracked approver-only user were deleted first. Deleting
 * tracked teams before tracked users sidesteps both cases; TeamMember rows
 * cascade-delete via either relation, so no separate cleanup is needed there.
 */
export class E2eCleanupTracker {
  private readonly userIds = new Set<number>();
  private readonly teamIds = new Set<number>();

  trackUser(id: number): void {
    this.userIds.add(id);
  }

  trackTeam(id: number): void {
    this.teamIds.add(id);
  }

  async cleanupAll(prisma: PrismaService): Promise<void> {
    assertTestDatabase();

    if (this.teamIds.size > 0) {
      await prisma.team.deleteMany({ where: { id: { in: [...this.teamIds] } } });
      this.teamIds.clear();
    }
    if (this.userIds.size > 0) {
      await prisma.user.deleteMany({ where: { id: { in: [...this.userIds] } } });
      this.userIds.clear();
    }
  }
}
