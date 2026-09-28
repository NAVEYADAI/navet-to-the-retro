// Test-only helper for frontend Playwright e2e (product-backlog/10-telegram-comment-ingestion.md
// §10.3) — there is no way to run a real Telegram conversation in an isolated e2e environment (no
// real bot/chat exists there). This script writes a `UserMessagingLink` row directly via Prisma
// (same DB the e2e backend itself uses) to put a user into the "linked" state, exactly like
// `POST /auth/telegram/link` would after a real, verified Telegram Login Widget round-trip. From
// there, the e2e spec drives the rest of the conversation state machine by calling
// `POST /telegram/webhook` directly (a real, unmocked endpoint) with a valid
// `X-Telegram-Bot-Api-Secret-Token` header and a fake Telegram update payload — see
// telegram-comment-ingestion.spec.ts for the full resolve→category→create chain this enables.
//
// Same safety guard as scripts/assert-e2e-db.js / e2e-seed-google-connection.js — refuses to run
// against anything but the isolated postgres-test service.
//
// Usage: node scripts/e2e-seed-telegram-link.js <userId> <externalId>

const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost:5433')) {
  console.error(
    'Refusing to seed a Telegram link: DATABASE_URL does not point at the isolated postgres-test ' +
    'service (localhost:5433). Check backend/.env.test.'
  );
  process.exit(1);
}

const [, , userIdArg, externalId] = process.argv;
const userId = Number(userIdArg);
if (!userId || !externalId) {
  console.error('Usage: node scripts/e2e-seed-telegram-link.js <userId> <externalId>');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.userMessagingLink.upsert({
      where: { channel_externalId: { channel: 'TELEGRAM', externalId } },
      update: { userId, isRevoked: false, activeTeamId: null, activeSprintId: null, pendingCommentContent: null, pendingCommentType: null, lastProcessedUpdateId: null },
      create: { channel: 'TELEGRAM', externalId, userId, isRevoked: false }
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
