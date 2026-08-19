import { TeamRole } from '@prisma/client';

export class CreateTeamDto {
  name!: string;
  mainOffice?: string;
  approverEmail!: string;
}

export class AddMemberDto {
  username!: string;
  role!: TeamRole;
}

export class UpdateMemberDto {
  role?: TeamRole;
  isAdmin?: boolean;
}
