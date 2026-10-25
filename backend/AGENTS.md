# Backend — AGENTS.md

> Sprint Retrospective Board — NestJS backend (Prisma + PostgreSQL).
> Read `../specs/00-shared-conventions.md` before touching auth, error mapping, or anything
> cross-cutting — it's the byte-accurate reference (derived from reading the code, not intent);
> this file is orientation, not a replacement for it.

## Tech Stack

- **Framework:** NestJS 11
- **ORM:** Prisma 6 + PostgreSQL — Neon in dev/prod; `postgres-test` (root `docker-compose.yml`)
  for e2e via `.env.test`
- **Auth:** manual JWT (`jsonwebtoken`) + `bcryptjs` — no Guards, no Passport, no NestJS auth module
- **Testing:** Jest (unit, colocated `*.spec.ts`) + Jest/Supertest (e2e, `test/`)
- **Language:** TypeScript, strict

## Modules

One NestJS module per domain under `src/`: `auth`, `teams`, `invites`, `sprints`, `comments`, `email`, `onboarding`.

## Architecture Patterns

### Auth — manual, not Guards

Every protected controller method calls `AuthService.validateToken(authHeader)` itself, at the top
of the method body, via `@Headers('authorization') authHeader: string`. There is no `@UseGuards`
anywhere. A new endpoint that should require auth must add this call explicitly — nothing enforces
it structurally, and it's easy to forget. See `specs/00-shared-conventions.md` §3 for the exact
failure-mode caveat (every `validateToken` failure collapses to `'Invalid token'`, never
`'User not found'` — a test expecting the latter is testing the wrong thing).

### DTOs — no runtime validation

DTOs are plain TypeScript classes with no `class-validator` decorators, and there is no global
`ValidationPipe` registered in `main.ts`. A missing required field is not a clean `400` — it's
whatever happens when `undefined` reaches Prisma (usually an uncaught `500`). Don't assume a DTO
type guarantees anything at runtime. Adding real validation to an endpoint is new work, not
something already covered by the DTO existing.

### Error → HTTP mapping

Throw NestJS's built-in exception classes directly from services — `UnauthorizedException` (401),
`ForbiddenException` (403), `NotFoundException` (404), `ConflictException` (409) — with the exact
user-facing message (Hebrew, for user-visible ones) as the constructor argument. No custom exception
filter, no error envelope beyond `{message}`.

### Per-team-owned entities — copy `invites`, not `teams`

When adding a new per-team resource with admin-gated mutation and soft-delete semantics (comment
categories, future settings, etc.), don't design the shape from scratch — `backend/src/invites/`
(`TeamInvite` model + `invites.service.ts`) is the established template: `teamId` FK with cascade, a
boolean soft-revoke/disable flag instead of a hard delete, and a guard checked at the top of every
mutating method.

### Reusable permission guard

`backend/src/teams/team-permissions.util.ts::assertCanManageTeamContent(prisma, teamId, requesterId)`
— `isAdmin === true || role === 'TEAM_LEADER'`. Use this directly for any new "team admin or team
lead" gated action instead of re-deriving the same check inline in a new service.

### Passwords & JWT

- `bcryptjs`, 10 salt rounds. Every `User`-shaped API response strips `password` manually
  (`const { password, ...result } = user`) — there's no `@Exclude`, so a new endpoint returning a
  `User` must remember to do this itself.
- JWT via `jsonwebtoken`, `expiresIn: '12h'`, secret from `JWT_SECRET` via `src/config/jwt-secret.ts::getJwtSecret()` (throws at startup if unset;
  only `NODE_ENV=test` gets a fixed test secret).

## Database

- שינויי סכמה נעשים עם **Prisma Migrate**: כל שינוי הוא קובץ מיגרציה ב-`backend/prisma/migrations/<ts>_<name>/migration.sql` שנכנס ל-git.
  **לא** `db push`. שינוי שהוא יותר מעמודה אופציונלית/ברירת מחדל (הרסני, NOT NULL, שינוי טיפוס) דורש תכנון נתונים בתוך אותו קובץ
  (ר' `product-backlog/03-team-comment-categories.md` כדוגמה לתכנון backfill מסוכן לפני הרצה על נתונים אמיתיים).
- **שום סוכן לא מחיל שינוי על production.** הוא עולה אך ורק בפריסה (release step של Fly) כקובץ שכבר נבדק בפיתוח. DB הבדיקות והפיתוח מתעדכנים
  דרך סקריפטי ה-npm שלמטה, לא דרך `prisma` גולמי.

### מיגרציות בין סביבות

שלוש סביבות: **בדיקות** (Docker, `localhost:5433`) · **פיתוח** (Neon branch `development`, `backend/.env` עם `APP_ENV=development`) ·
**production** (Neon branch `production`; הכתובת רק ב-Fly/מנהל הסודות). המנגנון כולו ב-`scripts/db-migrate.js`.

**יוצרים שינוי:**
1. עורכים `schema.prisma`.
2. `npm run migrate:new -- <snake_case_name>` (מתוך `backend/`): מחיל את המיגרציות הקיימות על DB הבדיקות, משווה אותו לסכמה, כותב את ה-SQL החסר לתיקייה
   חדשה, ומאמת שהיא משחזרת את הסכמה במדויק. אין צורך ב-shadow database.
3. קוראים את ה-`migration.sql` שנוצר. מוסיפים עמודה אופציונלית / טבלה חדשה — בטוח. `DROP`, `SET NOT NULL`, שינוי טיפוס, `DELETE` — עוצרים:
   מתכננים גיבוי/backfill **באותו קובץ**, ורק אז מוסיפים בראשו שורה `-- destructive-ok: <למה זה בטוח>`. בלי השורה הבדיקה הסטטית נכשלת
   (`migrate:check`, ב-`deploy.sh` ובשלב ה-release של Fly).
4. `npm run migrate:sync` מחיל על בדיקות ופיתוח. commit לתיקיית המיגרציה יחד עם `schema.prisma`.

**אוטומטי:**
- `migrate:test` רץ לפני `test:e2e` ו-`start:e2e` (`postgres-test` בלבד; מסרב לכל URL אחר). הוא גם **נכשל אם יש שינוי ב-`schema.prisma` בלי מיגרציה**.
  DB בדיקות במצב ישן (מ-`db push`) נבנה מחדש מהמיגרציות — הוא חד-פעמי לגמרי.
- קונטיינר ה-backend (`Dockerfile.dev` → `scripts/dev-schema-sync.sh`) מחיל מיגרציות על DB הפיתוח בעלייה ובכל שינוי של `schema.prisma`/מיגרציה;
  לא חוסם את עליית השרת אם מסרב. נדרש `APP_ENV=development`. מסרב אם ה-host שווה ל-`PROD_DATABASE_URL`; מנקז pooler של Neon ל-direct.
  DB פיתוח שנוצר ב-`db push` ותואם את הסכמה מאומץ אוטומטית (מסמן את כל המיגרציות כרצות).

**production:** ה-image **לא** מחיל כלום כשהאפליקציה עולה. ב-`npm run deploy`: `migrate:check` → כל הטסטים → `fly deploy`. ב-Fly,
`release_command` (`node scripts/db-migrate.js release`) רץ **ב-image החדש לפני שהגרסה עולה**: בודק שוב שאין מיגרציה הרסנית בלי סימון, ומריץ
`migrate deploy` — רק מיגרציות שעוד לא רצו, כל אחת בטרנזקציה. כל כשל = הפריסה מבוטלת וגרסה ישנה ממשיכה לרוץ. אין צורך ב-`PROD_DATABASE_URL`.
- **baseline (חד-פעמי, אוטומטי):** ה-production נוצר ב-`db push`, לפני שהיו מיגרציות, ולכן אין בו היסטוריית מיגרציות. בפריסה הראשונה ה-release step
  מזהה את זה (`P3005`) ומאמץ את ה-DB **רק אם הוא בדיוק "המיגרציה הראשונה (`…_init`) + המיגרציות המאוחרות"**: ה-SQL שחסר ל-DB מול הסכמה חייב להיות זהה
  ל-SQL של המיגרציות המאוחרות. אז הוא מסמן את `…_init` כ"כבר רצה" (בלי להריץ אותה) ומחיל את השאר. כל הבדל אחר = הפריסה נעצרת ושום דבר לא נכתב; אז מסמנים ידנית:
  `PROD_DATABASE_URL=… npm run migrate:baseline-prod` (נוה, בטרמינל שלו) ומדפיס מה עוד חסר.
- לא עורכים מיגרציה שכבר רצה בפיתוח או ב-production (ה-checksum נשבר והריצה הבאה נעצרת) — מוסיפים מיגרציה חדשה.
- `npm run env:set-dev-db` — נוה מריץ בטרמינל שלו; מעביר את כתובת ה-DB מהלוח ל-`backend/.env` (ול-`.env` שבשורש אם הוא מגדיר `DATABASE_URL`)
  בלי להדפיס אותה.
- בדיקות המנגנון: `npm run test:scripts` (יחידה) ו-`npm run test:release-flow` (אינטגרציה מול `postgres-test`). `.claude/guard.json` + ה-hooks של
  `dev-team` חוסמים גישה מקרית ל-production ואישור/כתיבת אישורים מתוך סשן Claude (ר' `TEAM.md` → Hard rules).

## Testing

- Unit: `*.spec.ts` colocated next to the file under test — `npm test` (jest `rootDir: src`).
- E2E: `npm run test:e2e` — Supertest, config in `test/jest-e2e.json`, env from `.env.test`.
- `NODE_OPTIONS=--experimental-vm-modules` is required in the `test`/`test:e2e` scripts —
  `pptxgenjs` does an internal dynamic `import()` that plain Jest can't handle. Don't strip this
  while "cleaning up" the scripts.

## CORS

`main.ts` explicitly exposes `Content-Disposition` via `app.enableCors({ exposedHeaders: [...] })`
— required for any endpoint returning a downloadable file with a computed filename; the frontend
can't read that header cross-origin without this.

## Known risk areas

`specs/00-shared-conventions.md` and `specs/02-teams-and-approval.md` document real bugs/edge cases
already found by reading this code (case-mismatch on approver-email lookup, orphaned-team risk,
missing request validation, inconsistent `isAdmin` vs `role==='TEAM_LEADER'` gating across
endpoints). Read these before touching `auth` or `teams` — they describe actual behavior, verified
against the code, not intended behavior.
