// Test-only helper for frontend Playwright e2e (product-backlog/06-google-calendar-integration.md
// §6.3) — there is no way to run a real Google OAuth round-trip in an isolated e2e environment
// (GOOGLE_CLIENT_ID/SECRET are intentionally left unset in backend/.env.test, see that file's
// comments), so `GET google-calendar/connect` always 500s there and the real
// `GET google-calendar/callback` code path can never be exercised end-to-end. This script writes
// a `GoogleCalendarConnection` row directly via Prisma (same DB the e2e backend itself uses) to
// put a user into the post-OAuth "connected" state, so the e2e spec can verify the *display* of
// that state and the real (unmocked) `PATCH google-calendar/disconnect` endpoint — it deliberately
// does not touch/mock `googleapis` itself, unlike the Jest suite. NOT a substitute for an actual
// token-exchange test; see the e2e spec's comments and product-backlog/06-google-calendar-
// integration.md §6.3 for the explicit limitation.
//
// Usage: node scripts/e2e-seed-google-connection.js <userId> <googleAccountEmail>
// Same safety guard as scripts/assert-e2e-db.js — refuses to run against anything but the
// isolated postgres-test service.

const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost:5433')) {
  console.error(
    'Refusing to seed a Google Calendar connection: DATABASE_URL does not point at the isolated ' +
    'postgres-test service (localhost:5433). Check backend/.env.test.'
  );
  process.exit(1);
}

const [, , userIdArg, googleAccountEmail] = process.argv;
const userId = Number(userIdArg);
if (!userId || !googleAccountEmail) {
  console.error('Usage: node scripts/e2e-seed-google-connection.js <userId> <googleAccountEmail>');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.googleCalendarConnection.create({
      data: {
        userId,
        accessToken: 'e2e-fake-access-token',
        refreshToken: 'e2e-fake-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        googleAccountEmail,
        isRevoked: false
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
