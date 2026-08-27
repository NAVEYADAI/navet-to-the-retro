import { TeamRole } from '@prisma/client';

export class CreateInviteDto {
  name?: string;
  email?: string;
  role?: TeamRole;
  expiresAt?: string;
  maxUses?: number;
}

export class UpdateInviteDto {
  isRevoked?: boolean;
}
