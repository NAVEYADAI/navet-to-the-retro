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

// Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.1).
export class CreatePhantomConversionInviteDto {
  expiresAt?: string;
}

export class ConsumePhantomConversionInviteDto {
  username!: string;
  email!: string;
  password!: string;
  firstName?: string;
  lastName?: string;
}
