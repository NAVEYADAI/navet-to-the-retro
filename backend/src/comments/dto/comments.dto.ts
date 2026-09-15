import { CommentType, CommentCategory } from '@prisma/client';

export class CreateCommentDto {
  content!: string;
  type!: CommentType;
  category?: CommentCategory;
  isAnonymous?: boolean;
  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1): when set, a team
  // admin/leader is posting this comment "on behalf of" this TeamMember's userId (a phantom, or
  // a real member) — see comments.service.ts::create.
  onBehalfOfUserId?: number;
}

export class UpdateHighlightDto {
  isHighlighted!: boolean;
}
