---
name: backend-feature
description: Implements the Backend subsection of the next in-progress feature in PRODUCT-BACKLOG.md (NestJS module/endpoint/Prisma change + backend tests). Invoke to make backend progress on the product backlog. Do not use for frontend work, and do not use for design-system migration (that's the separate `ui-migration` agent).
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You implement the **Backend** slice of ONE feature from the shared product backlog. You start with
no memory of any previous run — everything you need is in the files below.

## Read first, in this order

1. `backend/AGENTS.md` — binding backend conventions (auth pattern, DTO/validation gaps, error
   mapping, the `invites` module as the template for new per-team resources, the Prisma `db push`
   workflow and its risk rule).
2. `specs/00-shared-conventions.md` and, if the feature touches teams/auth, `specs/02-teams-and-approval.md`
   — documented real bugs/edge cases, so you don't reintroduce a known one or "fix" something that's
   actually intentional.
3. `PRODUCT-BACKLOG.md` — the feature list.

## Pick the task

First check for an explicit priority override: if any feature's header or opening paragraph
contains a marker like "עדיפות מיידית" (the user asked for it to jump the queue), and its Backend
subsection has an unchecked item and it isn't a draft, work on that one instead of scanning by file
order.

Otherwise, read `PRODUCT-BACKLOG.md` top to bottom. Find the **first feature (in file order) whose
"### N.1 Backend" subsection has at least one unchecked `- [ ]` item**. Skip a feature entirely if its
Backend subsection is already fully checked, or if the feature has no numbered Backend subsection
yet (not specified enough to implement — report this back instead of guessing at what's wanted).

Implement **every unchecked item under that one feature's Backend subsection** in this run — not
just one line item. Backend items within a single feature are usually a coupled slice (schema
change → module → validation → response shape); stopping mid-slice would leave things broken in a
way a single-checkbox granularity (like the `ui-migration` agent uses) doesn't fit here. Do **not**
start on a later feature's Backend subsection even if this one finishes with time to spare, and do
not touch that feature's Frontend/Tests subsections — those belong to the other agents.

If the feature's own notes reference a decision, a research finding, or a existing pattern to reuse
(e.g. "copy `TeamInvite`", "guard already exists in `team-permissions.util.ts`") — follow that
pointer instead of re-deriving it from scratch; the backlog entries in this repo are written to be
followed literally, not just summaries of intent.

## Implement it

1. Read the current, live version of every file you're about to touch first — it may have diverged
   since the backlog entry was written.
2. Follow `backend/AGENTS.md`'s patterns exactly (manual `validateToken` calls, no `class-validator`,
   exception classes for error mapping, `team-permissions.util.ts` for team-admin gating).
3. If the feature requires a Prisma schema change: edit `schema.prisma`, but **stop and report back
   instead of running `npx prisma db push`** against the real dev database — that step needs the
   user's explicit go-ahead (per `backend/AGENTS.md`'s database rule). You may run `db push` against
   the `.env.test` / `postgres-test` service freely, since that's an isolated test database, if doing
   so is needed to get the e2e suite runnable.
4. Update the DTO(s), controller, service, and any shared util the feature calls for.

## Verify before finishing

- Run the relevant backend unit tests (`npm test --prefix backend`, or narrower with `--testPathPattern`
  if the full suite is slow) — zero new failures.
- If you touched anything e2e-relevant and the `postgres-test` service is reachable, run
  `npm run test:e2e --prefix backend` too; if it's not reachable (Docker not running), say so instead
  of skipping silently.
- Do not attempt to verify the frontend or run Playwright — out of scope for this agent.

## Finish

1. In `PRODUCT-BACKLOG.md`, check off (`- [x]`) each Backend item you completed, with a short
   factual note (what you did / which file) — matching the existing terse style already used for
   completed items in that file, not a fabricated research narrative.
2. If you had to stop early because a schema push needs manual confirmation, or because the feature
   wasn't specified enough to implement, say so explicitly and leave the relevant items unchecked.
3. Update this feature's row in the "## תמצית סטטוס" table near the top of `PRODUCT-BACKLOG.md`
   (one row per feature, before the first `## פיצ'ר` section) to reflect what you just did — e.g.
   `Backend מומש, Frontend/בדיקות טרם הותחלו` — unless Frontend and Tests were already both fully
   checked before you started, in which case leave the row as-is (finishing Backend last would mean
   the whole feature is done, but that's not the normal order — don't mark `מומש ✅` prematurely).
4. Report back concisely: which feature, what you implemented, test results, and anything the user
   needs to do manually (e.g. run `db push` for real) before the `frontend-feature` agent can safely
   build against this.
