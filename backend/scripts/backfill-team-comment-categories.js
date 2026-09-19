// One-time data migration for product-backlog/03-team-comment-categories.md §3.0 decision #4 /
// §3.1 checklist item 3.
//
// WHY THIS EXISTS: this project has no `prisma migrate` migration files (see backend/AGENTS.md's
// "Database" section) — schema changes are applied directly via `prisma db push`. Replacing
// `Comment.category` (a Postgres enum column) with `Comment.categoryId` (an FK to the new
// `TeamCommentCategory` table) can't be a single additive `db push`: existing rows' category data
// has to be *read* from the old column and *written* into the new table/column before the old
// column can safely be dropped. `@default()` cannot do this (see the documented Prisma
// default-value backfill trap elsewhere in this project's history) — it would silently stamp a
// wrong value on every existing row instead of preserving what was actually there.
//
// REQUIRED RUN ORDER (do not skip a step or run them out of order):
//   1. schema.prisma must be in the INTERMEDIATE state: the new `TeamCommentCategory` model AND
//      `Comment.categoryId Int?` both exist, AND the legacy `Comment.category CommentCategory?`
//      field + `enum CommentCategory` are STILL present (not yet removed). `npx prisma db push`
//      + `npx prisma generate` against that intermediate schema first.
//   2. Run this script: `node scripts/backfill-team-comment-categories.js` (dry run — prints a
//      plan, writes nothing) then `node scripts/backfill-team-comment-categories.js --confirm`
//      (writes). Safe to re-run: it only creates a default category row if a team doesn't already
//      have one with that exact label, and only maps a Comment whose `categoryId` is still null.
//   3. Verify the printed summary — 0 unmapped comments (a nonzero "unknown legacy category"
//      warning means a comment's old value doesn't match any of the 13 default labels; do not
//      proceed to step 4 until that's understood/resolved).
//   4. ONLY THEN edit schema.prisma to the FINAL state (drop `Comment.category` and
//      `enum CommentCategory` entirely) and `npx prisma db push` again.
//
// This was written and tested against an intermediate schema on the isolated `postgres-test`
// service — see product-backlog/03-team-comment-categories.md's Backend checklist notes for what
// was verified before this script is ever pointed at the real (Neon) database. Running it against
// the real database is a manual, human-approved step — this script does not enforce a
// postgres-test-only guard (unlike the e2e-only helpers in this directory) because, unlike those,
// it is meant to eventually run for real, once.

const { PrismaClient } = require('@prisma/client');

// Mirrors backend/src/comments/comment-category-labels.ts's COMMENT_CATEGORY_LABELS — kept in
// sync manually (same as that file's own relationship to frontend/src/constants/strings.ts).
// Order matches the old CommentCategory enum's declaration order in schema.prisma.
const DEFAULT_CATEGORIES = [
  { legacyKey: 'SPRINT_SETUP', label: 'התארגנות לספרינט' },
  { legacyKey: 'PRE_PLANNING', label: 'פרה-פלנינג' },
  { legacyKey: 'PLANNING', label: 'פלנינג' },
  { legacyKey: 'ONGOING_WORK', label: 'עבודה שוטפת' },
  { legacyKey: 'TESTING', label: 'בדיקות' },
  { legacyKey: 'AVAILABILITY', label: 'זמינות' },
  { legacyKey: 'ESTIMATIONS', label: 'תמחורים' },
  { legacyKey: 'SPECIFICATIONS', label: 'איפיונים' },
  { legacyKey: 'TASK_DISTRIBUTION', label: 'חלוקת משימות' },
  { legacyKey: 'PERSONAL', label: 'אישי' },
  { legacyKey: 'FUN', label: 'הוואי ובידור' },
  { legacyKey: 'GENERAL', label: 'כללי' },
  { legacyKey: 'TECHNICAL', label: 'טכני' }
];

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  try {
    const teams = await prisma.team.findMany({ select: { id: true, name: true } });
    console.log(`Found ${teams.length} team(s).`);

    let totalCategoriesCreated = 0;
    let totalCommentsMapped = 0;
    let totalUnknown = 0;

    for (const team of teams) {
      const existing = await prisma.teamCommentCategory.findMany({ where: { teamId: team.id } });
      const byLabel = new Map(existing.map(c => [c.label, c]));

      const toCreate = DEFAULT_CATEGORIES.filter(d => !byLabel.has(d.label));

      if (confirm && toCreate.length > 0) {
        await prisma.teamCommentCategory.createMany({
          data: toCreate.map(d => ({ teamId: team.id, label: d.label, isDefault: true, isEnabled: true }))
        });
        const refreshed = await prisma.teamCommentCategory.findMany({ where: { teamId: team.id } });
        for (const row of refreshed) byLabel.set(row.label, row);
      }
      totalCategoriesCreated += toCreate.length;

      // legacyKeyToRow: which DB row each old enum key resolves to for this team. In --confirm
      // mode this is built AFTER the createMany above, so it includes both rows that already
      // existed and the ones just created. In dry-run mode nothing was created, so it's built
      // from DEFAULT_CATEGORIES directly (labels not yet in the DB are still "known" — they will
      // exist once --confirm actually creates them) purely to report an accurate plan; only a
      // legacy value that isn't one of the 13 known keys at all counts as genuinely unrecognized.
      const legacyKeyToRow = new Map();
      for (const d of DEFAULT_CATEGORIES) {
        const row = byLabel.get(d.label);
        if (row) legacyKeyToRow.set(d.legacyKey, row);
      }
      const knownLegacyKeys = new Set(DEFAULT_CATEGORIES.map(d => d.legacyKey));

      // Raw SQL, not `prisma.comment.findMany`: this reads the legacy `category` enum column,
      // which only exists in the intermediate schema state described above (see the Prisma
      // client generated from that schema still exposing `category`; once the final schema drops
      // that column, this query would simply fail loudly — a deliberate, correct failure, not a
      // silent data-loss risk).
      const legacyComments = await prisma.$queryRawUnsafe(
        `SELECT id, category FROM "Comment" WHERE "teamId" = $1 AND category IS NOT NULL AND "categoryId" IS NULL`,
        team.id
      );

      let mappedForTeam = 0;
      let unknownForTeam = 0;
      if (confirm) {
        for (const c of legacyComments) {
          const row = legacyKeyToRow.get(c.category);
          if (!row) {
            unknownForTeam++;
            console.warn(`  ! team ${team.id} ("${team.name}"): comment ${c.id} has unrecognized legacy category "${c.category}" — left categoryId null.`);
            continue;
          }
          await prisma.$executeRawUnsafe(`UPDATE "Comment" SET "categoryId" = $1 WHERE id = $2`, row.id, c.id);
          mappedForTeam++;
        }
      } else {
        for (const c of legacyComments) {
          if (knownLegacyKeys.has(c.category)) mappedForTeam++;
          else unknownForTeam++;
        }
      }
      totalCommentsMapped += mappedForTeam;
      totalUnknown += unknownForTeam;

      console.log(
        `Team ${team.id} ("${team.name}"): ${toCreate.length} default categor${toCreate.length === 1 ? 'y' : 'ies'} ` +
        `${confirm ? 'created' : 'to create'}, ${mappedForTeam} comment(s) ${confirm ? 'mapped' : 'to map'}` +
        (unknownForTeam > 0 ? `, ${unknownForTeam} unrecognized` : '')
      );
    }

    console.log(
      `\nTotals: ${totalCategoriesCreated} category rows, ${totalCommentsMapped} comment mappings` +
      (totalUnknown > 0 ? `, ${totalUnknown} unrecognized (left unmapped)` : '') + '.'
    );
    console.log(confirm
      ? '\nDone — data written.'
      : '\nDry run only (no --confirm flag) — nothing was written. Re-run with --confirm to apply.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
