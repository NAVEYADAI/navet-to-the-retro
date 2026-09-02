export class CreateSprintDto {
  name!: string;
  description?: string;
  startDate!: string;
  endDate!: string;
}

export class UpdateSprintDto {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}
