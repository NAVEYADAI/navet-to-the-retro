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

One NestJS module per domain under `src/`: `auth`, `teams`, `invites`, `sprints`, `comments`, `email`.

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
- JWT via `jsonwebtoken`, `expiresIn: '12h'`, secret from `JWT_SECRET` (falls back to a hardcoded
  dev secret if unset — never rely on that fallback outside local dev).

## Database

- Workflow is `npx prisma db push`, **not** `prisma migrate` — there are no migration files in this
  project. A schema change is applied directly; anything beyond an additive nullable/defaulted
  column needs a hand-planned backfill script (see `product-backlog/03-team-comment-categories.md`
  for a worked example of planning a risky backfill before running it against real data).
- **Never run `prisma db push` against the shared dev/prod Neon database without the user's
  explicit go-ahead first** — it's not an isolated per-agent database. Pushing against the
  `postgres-test` service for e2e (`.env.test`) is safe to do directly.

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
