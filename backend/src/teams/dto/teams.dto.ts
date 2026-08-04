import { TeamRole } from '@prisma/client';

export class CreateTeamDto {
  name!: string;
  mainOffice?: string;
}

export class AddMemberDto {
  userId!: number;
  role!: TeamRole;
}
