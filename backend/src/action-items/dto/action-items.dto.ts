export class CreateActionItemDto {
  title!: string;
  sourceCommentId?: number | null;
  assigneeIds?: number[];
  dueDate?: string | null;
}

export class UpdateActionItemDto {
  title?: string;
  status?: 'OPEN' | 'DONE' | 'DROPPED';
  assigneeIds?: number[];
  dueDate?: string | null;
}
