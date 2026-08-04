import { CommentType } from '@prisma/client';

export class CreateCommentDto {
  content!: string;
  type!: CommentType;
  isAnonymous?: boolean;
}
