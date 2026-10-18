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

- Workflow is `npx prisma db push`, **not** `prisma migrate` — there are no migration files in this
  project. A schema change is applied directly; anything beyond an additive nullable/defaulted
  column needs a hand-planned backfill script (see `product-backlog/03-team-comment-categories.md`
  for a worked example of planning a risky backfill before running it against real data).
- **Never apply a schema change to production without the user's explicit go-ahead, and never from an agent session.**
  Test DB (`postgres-test`) and the development DB are free to update — through the npm scripts below, not raw `prisma`.

### סנכרון סכמה בין סביבות (למה פריסה נכשלת מול ה-DB)

שלוש סביבות: **בדיקות** (Docker, `localhost:5433`) · **פיתוח** (Neon branch `development`, `backend/.env` עם `APP_ENV=development`) ·
**production** (Neon branch `production`; הכתובת רק ב-Fly/מנהל הסודות, ונכנסת לפקודות כ-`PROD_DATABASE_URL`). כלל הברזל:
**בפיתוח ובבדיקות הסכמה מתעדכנת מעצמה; ב-production היא משתנה אך ורק בפריסה, ואך ורק אם נוה אישר את ה-SQL המדויק.**

**פיתוח ובדיקות (אוטומטי):**
- `npm run schema:sync` — מעדכן את בסיס הבדיקות **ואת בסיס הפיתוח** לפי `schema.prisma`.
- קונטיינר ה-backend (`Dockerfile.dev` → `scripts/dev-schema-sync.sh`) מעדכן את DB הפיתוח בעלייה ובכל שינוי של `schema.prisma`; לא חוסם את
  עליית השרת אם מסרב. נדרש `APP_ENV=development` (compose מעביר אותו מה-`.env` שבשורש).
- `schema:test:push` רץ אוטומטית לפני `test:e2e` ו-`start:e2e` (`postgres-test` בלבד; מסרב לכל URL אחר).
- `schema:dev:push` מסרב אם `APP_ENV` אינו `development` או אם ה-host שווה ל-`PROD_DATABASE_URL`; מנקז pooler של Neon ל-direct; **נכשל ולא מוחק**
  על שינוי שעלול לאבד נתונים (`SCHEMA_ACCEPT_DATA_LOSS=1` — רק לפיתוח, במודע).

**production (באישור בלבד):** ה-image **לא** מריץ `db push` כשהאפליקציה עולה. במקום זה:
1. **ניתוח:** `PROD_DATABASE_URL=… npm run schema:plan:prod` — מסווג כל פעולה 🟢 בטוח / 🟡 דורש בדיקה / 🔴 הרסני, מציג כמה שורות יש בטבלאות,
   מציע תיקונים (גיבוי לפני מחיקה, שינוי שם במקום drop+add, backfill לפני NOT NULL, בדיקת כפילויות לפני unique…) ונותן **מזהה תוכנית**.
   אותו ניתוח רץ אוטומטית מול DB הפיתוח כשעורכים את `schema.prisma` (hook), ו-Claude מסביר מה זה אומר ומציע טיוטת תיקון.
2. **תיקון (אם צריך):** טיוטה ב-`backend/schema-fixes/<מזהה>.pre.sql`. היא רצה **ראשונה, באותה טרנזקציה** כמו התוכנית; אסור שיישארו בה `<placeholders>`.
3. **אישור:** `PROD_DATABASE_URL=… npm run schema:approve:prod` (נוה בטרמינל שלו) — מציג הכול, ודורש להקליד `APPLY <מזהה>`. כותב
   `backend/schema-approvals/<מזהה>.json` (נכנס ל-git ול-image). **האישור קשור ל-SQL המדויק**: שינוי אחר, או production שהשתנה מאז, יוצר
   מזהה אחר ולכן לא מאושר. עריכת קובץ האישור משביתה אותו.
4. **פריסה:** `deploy.sh` מריץ `schema:gate:prod` לפני הבנייה (מסונכרן או מאושר — אחרת עוצר), ואז ב-Fly `release_command`
   (`node scripts/schema-sync.js release`) רץ **ב-image החדש לפני שהגרסה עולה**: מחשב מחדש את התוכנית מול ה-DB החי, ומיישם אותה **רק אם יש אישור**,
   אטומית (`BEGIN … COMMIT`, תיקון קודם), ואז מאמת שה-DB תואם. כל כשל = הפריסה מבוטלת וגרסה ישנה ממשיכה לרוץ.
- טבלאות גיבוי `_bak_*` שתיקון יוצר נשארות בכוונה (התוכנית מתעלמת מהן); מוחקים אותן ידנית כשבטוחים. עד אז `db push` ב-dev/test יסרב אם הן קיימות שם.
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
