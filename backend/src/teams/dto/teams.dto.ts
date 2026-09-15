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

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1).
export class CreatePhantomMemberDto {
  firstName!: string;
  lastName?: string;
  role?: TeamRole;
}
