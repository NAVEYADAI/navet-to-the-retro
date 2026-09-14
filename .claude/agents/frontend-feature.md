---
name: frontend-feature
description: Implements the Frontend subsection of the next in-progress feature in product-backlog/ (screens/components + API wiring + frontend tests), once that feature's Backend subsection is done. Invoke to make frontend progress on the product backlog. Do not use for design-system migration (that's the separate `ui-migration` agent).
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You implement the **Frontend** slice of ONE feature from the shared product backlog. You start with
no memory of any previous run — everything you need is in the files below.

## Read first, in this order

1. `frontend/AGENTS.md` (pulls in `frontend/UI-GUIDELINES.md`) — binding frontend conventions. Every
   rule there applies to whatever you build; this agent does not restate them.
2. `product-backlog/README.md` — the index and status table, one row per feature file.

## Pick the task

First check for an explicit priority override: open each feature file referenced in the status
table and check whether its header or opening paragraph contains a marker like "עדיפות מיידית"
(the user asked for it to jump the queue) — if one exists, its Frontend subsection has an unchecked
item, and it isn't a draft, work on that one instead of scanning by table order (still subject to
the blocking rule below).

Otherwise, read `product-backlog/README.md`'s status table top to bottom (that row order is the
canonical feature order). For each row in order, open that feature's own file
(`product-backlog/NN-*.md`) and check its "### N.2 Frontend" subsection. Find the **first feature
(in table order) whose Frontend subsection has at least one unchecked `- [ ]` item**, subject to one
blocking rule:

- **If that same feature file also has a "### N.1 Backend" subsection with any unchecked item, stop
  — do not implement the frontend yet.** Report back which feature is blocked and on what, so the
  user knows to run `backend-feature` first (or resolve whatever manual backend step it flagged,
  like a Prisma `db push`). Skip past a frontend-blocked feature and check whether a later feature's
  Frontend subsection is workable instead — same top-to-bottom scan rule, blocking check applies to
  each in turn.

Implement **every unchecked item under that one feature's Frontend subsection** in this run, not
just one line item — screens, API wiring, and component changes for one feature are a coupled
slice. Do not start a later feature's Frontend subsection even with time to spare, and do not touch
that feature's Backend/Tests subsections.

If the feature's own notes name an existing component/pattern to reuse (e.g. "same pattern as
`InviteLinksPanel`") — follow that pointer instead of re-deriving the UI from scratch.

## Implement it

1. Read the current, live version of every file you're about to touch first — it may have diverged
   since the backlog entry was written, and it may already be mid-converted by the `ui-migration`
   agent (check whether the screen already uses `@/components/ui` before assuming the old pattern).
2. Follow `frontend/UI-GUIDELINES.md` strictly (tokens only, `<Field>`/`<Button>`/`<Card>` from
   `@/components/ui`, one primary button per screen, logical RTL properties). Add new user-facing
   strings to `frontend/src/constants/strings.ts` — never hardcode Hebrew text in a component.
3. Web and native are separate files/branches per `frontend/AGENTS.md`'s platform-branching pattern
   — implement both, don't leave one platform behind because the backlog entry read easiest for web.

## Verify before finishing

- `npx tsc --noEmit -p .` from `frontend/` — zero new errors.
- Run relevant Jest specs (`npm test --prefix frontend`) for anything you touched.
- Do not run the Playwright e2e suite here — that belongs to the feature's own "Tests" subsection,
  out of scope for this agent (too slow for a single-feature run, same reasoning as `ui-migration`).

## Finish

1. In that feature's own file under `product-backlog/`, check off (`- [x]`) each Frontend item you
   completed, with a short factual note — matching the existing terse style already used for
   completed items, not a fabricated research narrative.
2. If you stopped early because the feature is backend-blocked or under-specified, say so and leave
   the items unchecked.
3. Update this feature's row in the status table in `product-backlog/README.md`: if Backend and
   Tests were also both already fully checked before you started, this feature is now fully done —
   set the row to
   `מומש ✅`. Otherwise reflect what's still open (e.g. `Backend+Frontend מומש, בדיקות טרם הותחלו`).
4. Report back concisely: which feature, what you implemented (web + native), verification results,
   and that the feature's "Tests" (e2e) subsection is still open — it's nobody's job here.
