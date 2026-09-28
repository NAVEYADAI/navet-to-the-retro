// Raw Telegram Login Widget callback payload — see telegram-auth.util.ts for the fields' meaning
// and verification. No `class-validator` decorators, per backend/AGENTS.md ("DTOs — no runtime
// validation"): `verifyTelegramLoginHash` effectively acts as the real validation here (a
// tampered/incomplete payload just fails the hash check).
export class TelegramLoginPayloadDto {
  id!: number;
  first_name!: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date!: number;
  hash!: string;
}
