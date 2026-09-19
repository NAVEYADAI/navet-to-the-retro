import { CommentType } from '@prisma/client';

export class CreateCommentDto {
  content!: string;
  type!: CommentType;
  // Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.1):
  // replaces the old `category` enum field — validated in comments.service.ts::create (must
  // belong to the same team as the sprint, and be isEnabled) rather than relying on a DB
  // constraint, per this project's usual "DTOs have no runtime validation" gap (backend/AGENTS.md).
  categoryId?: number;
  isAnonymous?: boolean;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1): when set, a team
  // admin/leader is posting this comment "on behalf of" this TeamMember's userId (a phantom, or
  // a real member) — see comments.service.ts::create.
  onBehalfOfUserId?: number;
}

export class UpdateHighlightDto {
  isHighlighted!: boolean;
}
