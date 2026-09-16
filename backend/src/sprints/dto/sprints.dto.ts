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
  // Feature 5 (product-backlog/05-sprint-length-audit-log.md §5.0 decision #5): free-text,
  // optional. Only persisted onto the SprintLengthChange row created when startDate/endDate
  // actually change — ignored otherwise (no date change = no audit row = nowhere to put it).
  reason?: string;
}
