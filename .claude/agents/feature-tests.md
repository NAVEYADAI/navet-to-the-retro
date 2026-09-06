---
name: feature-tests
description: Writes the Tests subsection (Playwright e2e + any remaining Jest coverage) for the next feature in PRODUCT-BACKLOG.md whose Backend and Frontend subsections are both fully done. Invoke once backend-feature and frontend-feature have both finished a feature, or let feature-orchestrator invoke it automatically as the last step.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You write the **Tests** slice of ONE feature from the shared product backlog — the piece neither
`backend-feature` nor `frontend-feature` covers. You start with no memory of any previous run.

## Read first

1. `PRODUCT-BACKLOG.md` — the feature list, and the existing "בדיקות" subsections of already-done
   features (1, 2, 4) as your style/coverage-depth reference: Desktop+Mobile Chrome Playwright
   projects, permission-based visibility assertions (not just "hidden" but actually absent from the
   DOM/role query), RTL layout assertions via `boundingBox()` where layout direction matters.
2. `backend/AGENTS.md` and `frontend/AGENTS.md` — test tooling and conventions for each side
   (`NODE_OPTIONS=--experimental-vm-modules` for backend Jest, Playwright config location, etc).

## Pick the task

First check for an explicit priority override: if any feature's header or opening paragraph
contains a marker like "עדיפות מיידית" (the user asked for it to jump the queue), and its Backend
and Frontend are both fully checked with its Tests subsection still open, work on that one first.

Otherwise, find the **first feature (in file order) whose Backend and Frontend subsections are both
fully checked, but whose "### N.3 בדיקות" subsection still has an unchecked `- [ ]` item.** If a
feature's Backend or Frontend still has open items, it is not ready for you yet — skip it and check
the next feature in order; do not write tests against a half-built feature.

## Write and run the tests

1. Playwright e2e (`frontend/e2e/`): cover the feature's main success flow and at least one
   permission-boundary case (the user who should NOT see/do the thing, verified as actually absent,
   not just visually hidden) — matching the depth of coverage already in this repo's existing specs.
2. Any Jest coverage the feature's Tests subsection calls for that isn't already implied by the
   verification step `backend-feature`/`frontend-feature` already ran (e.g. a dedicated
   pure-function test, a service-level edge case not exercised by the e2e flow).
3. Actually run everything you write (`npm run test:e2e --prefix frontend`, `npm test --prefix backend`
   / `--prefix frontend` as relevant) and fix failures — a red test you didn't reconcile is worse
   than no test. If a failure reveals a real implementation bug rather than a wrong test, report it
   explicitly instead of loosening the assertion to make it pass.

## Finish

1. Check off (`- [x]`) each Tests item you completed in `PRODUCT-BACKLOG.md`, with a short factual
   note, matching the terse style already used for completed items.
2. If every subsection of the feature (Backend/Frontend/Tests) is now checked, say so explicitly —
   that feature is fully done. Since you only ever run once Backend+Frontend are already checked,
   finishing Tests means the whole feature is done: update this feature's row in the "## תמצית
   סטטוס" table near the top of `PRODUCT-BACKLOG.md` (one row per feature, before the first
   `## פיצ'ר` section) to `מומש ✅`. If you stopped early with Tests items still unchecked, leave
   the row as whatever it already said.
3. Report back: which feature, what was tested, pass/fail results, and any real bug found along the
   way (not just test-writing mechanics).
