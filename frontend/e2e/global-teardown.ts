import path from 'path';
import fs from 'fs';

// Minimal KEY=value parser — avoids pulling in the `dotenv` package just for this script.
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) result[match[1]] = (match[2] || '').trim();
  }
  return result;
}

// Deletes every user this e2e run created (by the 'e2e_pw_' username prefix used throughout
// frontend/e2e/*.spec.ts) from the isolated test database — teams/members/sprints/comments
// cascade-delete via Prisma's onDelete: Cascade relations (see backend/prisma/schema.prisma).
// Guarded the same way as the backend's own supertest e2e suite: refuses to run unless
// DATABASE_URL clearly points at the local postgres-test Docker service, never the real DB.
async function globalTeardown() {
  const backendDir = path.resolve(__dirname, '../../backend');
  const testEnv = parseEnvFile(path.join(backendDir, '.env.test'));
  const devEnv = parseEnvFile(path.join(backendDir, '.env'));

  const testUrl = testEnv.DATABASE_URL;
  if (!testUrl || !testUrl.includes('localhost:5433')) {
    throw new Error(
      'e2e global teardown: DATABASE_URL in backend/.env.test does not point at the isolated ' +
      'postgres-test service (localhost:5433) — refusing to run cleanup.'
    );
  }
  if (devEnv.DATABASE_URL && testUrl === devEnv.DATABASE_URL) {
    throw new Error(
      'e2e global teardown: backend/.env.test has the same DATABASE_URL as backend/.env — ' +
      'refusing to run cleanup against what might be the real database.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require(path.join(backendDir, 'node_modules/@prisma/client'));
  const prisma = new (PrismaClient as any)({ datasources: { db: { url: testUrl } } });
  try {
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_pw_' } } });
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
