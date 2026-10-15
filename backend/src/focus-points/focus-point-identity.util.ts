import { Prisma } from '@prisma/client';

// Feature 20 §20.0 #20: when a member leaves a team (or is removed) their ratings and proposals
// stay — the scores are the team's history — but the link to the person is erased.
export async function clearFocusPointIdentity(tx: Prisma.TransactionClient, userId: number, teamId: number) {
  await tx.focusPointRating.updateMany({
    where: { userId, focusPoint: { teamId } },
    data: { userId: null }
  });
  await tx.focusPointProposal.updateMany({
    where: { userId, comment: { teamId } },
    data: { userId: null }
  });
}
