export class CreateFocusPointDto {
  kind!: 'IMPROVE' | 'KEEP';
  text!: string;
  initialScore?: number;
  sourceCommentIds?: number[];
}

export class UpdateFocusPointDto {
  text?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  watchSprintsLeft?: number | null;
  addSourceCommentIds?: number[];
}

export class MergeFocusPointDto {
  intoId!: number;
  text?: string;
}

export class RateFocusPointDto {
  sprintId!: number;
  score!: number;
  reason?: string | null;
}

export class UpdateFocusPointSettingsDto {
  quota?: number;
}

export class CreateFocusPointTaskDto {
  title!: string;
  assigneeId?: number | null;
  dueDate?: string | null;
}

export class UpdateFocusPointTaskDto {
  title?: string;
  assigneeId?: number | null;
  dueDate?: string | null;
  status?: 'OPEN' | 'DONE' | 'DROPPED';
}
