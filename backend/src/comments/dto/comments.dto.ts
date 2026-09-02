import { CommentType, CommentCategory } from '@prisma/client';

export class CreateCommentDto {
  content!: string;
  type!: CommentType;
  category?: CommentCategory;
  isAnonymous?: boolean;
}

export class UpdateHighlightDto {
  isHighlighted!: boolean;
}
