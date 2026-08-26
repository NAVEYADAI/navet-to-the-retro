// Guard for `npm run start:e2e` (a real listening server used by Playwright e2e) — the
// jest-based backend e2e suite already guards itself via test/utils/require-test-db.ts +
// jest globalSetup, but that path never runs here, so this is a lightweight standalone check.
const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost:5433')) {
  console.error(
    'Refusing to start the e2e backend: DATABASE_URL does not point at the isolated ' +
    'postgres-test service (localhost:5433). Check backend/.env.test.'
  );
  process.exit(1);
}
