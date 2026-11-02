import { Prisma } from '@prisma/client';

// Feature 13: a write extension belongs to a member of the sprint's team. When that member leaves or
// is removed, their extensions on the team's sprints go with them — otherwise the row would sit in
// the admin's "active extensions" list and silently revive if the person is invited back later.
export async function clearWriteExtensions(tx: Prisma.TransactionClient, userId: number, teamId: number) {
  await tx.sprintWriteExtension.deleteMany({ where: { userId, sprint: { teamId } } });
}
