# schema-approvals

One JSON file per **approved production schema change** (`<plan id>.json`). Created by
`npm run schema:approve:prod` after you review the plan; committed to git and baked into the backend image.

The Fly release step (`fly.toml` → `release_command`) recomputes the plan against the live production DB and
applies it **only if an approval for that exact SQL exists**. Anything else stops the deploy before the new version
goes live. See `backend/AGENTS.md` → "סנכרון סכמה בין סביבות".

Fix drafts (backups, backfills, renames) live in `../schema-fixes/<plan id>.pre.sql`; the approved version is
copied into the approval file and runs first, in the same transaction.
