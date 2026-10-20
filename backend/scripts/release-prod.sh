#!/usr/bin/env bash
# One command to ship to production with the database brought up to date — run it yourself, in your own terminal.
#   1. In the Neon console open branch "production" → Connect → copy the connection string.
#   2. From the repo root, on `main` with nothing uncommitted:   npm run release:prod
#      (add `-- --plan` to only look: it prints what would change in production and stops.)
#
# What it does, in order:
#   - reads the production URL from your clipboard (never printed, never on a command line) and clears the clipboard;
#   - production gate: if the live DB is in sync, or the change is already approved, there is nothing to approve;
#   - otherwise shows you the plan and asks YOU to type "APPLY <id>" (the approval is yours alone — nothing here
#     approves for you), then commits the approval file;
#   - runs ./deploy.sh (all tests → gate → backend → frontend). The Fly release step then applies exactly the
#     approved SQL before the new version goes live, so code and database ship together.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
CLIP_CMD="${CLIPBOARD_CMD:-pbpaste}"
PLAN_ONLY=0; [[ "${1:-}" == "--plan" ]] && PLAN_ONLY=1

die() { printf '\n✖ %s\n\n' "$1" >&2; exit 1; }

# The approval must be typed by a person: never let an environment variable answer for them.
unset SCHEMA_APPROVE_CONFIRM

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || die "You are on '$branch'. Production is deployed from main — switch to main (or run this from the main worktree) first."
# Uncommitted tracked changes would ship to production without being in git.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no >&2
  die "There are uncommitted changes (above). Commit or stash them: what is deployed must be what is in git."
fi

# Neon's Connect dialog can hand you the bare URL, a `psql '<url>'` line, or `DATABASE_URL="<url>"` — take the URL out of any of them.
clip="$(bash -c "$CLIP_CMD")"
url="$(printf %s "$clip" | grep -oE "postgres(ql)?://[^'\" [:space:]]+" | head -1 || true)"
clip=""
[[ "$CLIP_CMD" == "pbpaste" ]] && { pbcopy </dev/null || true; }   # the URL now lives only in this process
re='^postgres(ql)?://([^:@/]+):([^@]+)@([^/:?]+)(:[0-9]+)?/([^?]+)(\?.*)?$'
[[ "$url" =~ $re ]] || die "The clipboard does not hold a Postgres connection string (postgresql://user:pass@host/db). In Neon → Connect: pick branch \"production\", turn on \"Show password\", and copy the connection string (a command line or DATABASE_URL=… line that contains it also works). Then run again."
host="${BASH_REMATCH[4]}"; db="${BASH_REMATCH[6]}"
[[ "${BASH_REMATCH[3]}" =~ ^[*•]+$ ]] && die "The password in the copied string is hidden (****). In Neon → Connect turn on \"Show password\" and copy again."
[[ "$host" == *.neon.tech || "${ALLOW_NON_NEON:-0}" == "1" ]] || die "Host '$host' is not a Neon host. Copy the connection string from the Neon console."

# If backend/.env is already the development DB, the clipboard must not be that same database.
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"
norm() { sed -E 's/-pooler//'; }
if [[ -f "$ENV_FILE" ]] && grep -qE '^APP_ENV=development' "$ENV_FILE"; then
  dev_url="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'[:space:]" || true)"
  if [[ "$dev_url" =~ $re ]]; then
    dev_host="${BASH_REMATCH[4]}"
    [[ "$(printf %s "$dev_host" | norm)" != "$(printf %s "$host" | norm)" ]] \
      || die "The clipboard points at the DEVELOPMENT database ($dev_host). Copy the connection string of branch \"production\"."
  fi
else
  echo "Note: backend/.env is not switched to the development DB yet, so I cannot rule out that you copied the development URL. Check the target below."
fi

printf '\nProduction target:  host %s   database %s\n' "$host" "$db"
if [[ "${RELEASE_ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "Is that the PRODUCTION database? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || die "Cancelled — nothing changed."
fi

export PROD_DATABASE_URL="$url"

if [[ $PLAN_ONLY -eq 1 ]]; then
  echo; echo "── What would change in production (read-only) ──"
  npm run -s schema:plan:prod --prefix backend
  echo; echo "Plan only — nothing approved, committed or deployed."
  exit 0
fi

echo; echo "── 1/3  Production schema ──"
if npm run -s schema:gate:prod --prefix backend; then
  echo "No approval needed."
else
  echo
  echo "Production is behind the schema. Review the plan above, then type the approval phrase yourself."
  npm run -s schema:approve:prod --prefix backend
  git add backend/schema-approvals
  [[ -d backend/schema-fixes ]] && git add backend/schema-fixes
  if ! git diff --cached --quiet; then
    git commit -q -m "chore: approve production schema plan"
    echo "✔ Approval committed: $(git log --oneline -1)"
  fi
fi

echo; echo "── 2/3  Deploy (tests → gate → backend → frontend) ──"
./deploy.sh

echo; echo "── 3/3  Done ──"
echo "Check the app in the browser (hard refresh: Cmd+Shift+R). Push main when you are happy:  git push origin main"
