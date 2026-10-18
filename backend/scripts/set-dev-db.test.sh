#!/usr/bin/env bash
# Self-test for set-dev-db.sh — uses FAKE URLs and a temp env file; never touches backend/.env or the clipboard.
#   bash backend/scripts/set-dev-db.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/set-dev-db.sh"
T="$(mktemp -d)"; ENVF="$T/env"; fail=0
ok()  { printf '  ✔ %s\n' "$1"; }
bad() { printf '  ✖ %s\n' "$1"; fail=1; }
reset_env() { printf 'JWT_SECRET=keepme\nDATABASE_URL=postgresql://u:p@ep-old-prod-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require\n' > "$ENVF"; }
# ROOT_ENV_FILE always points into the temp dir, so a test can never touch the repo's real root .env.
run() { ENV_FILE="$ENVF" ROOT_ENV_FILE="${ROOT_ENV_FILE:-$T/no-root-env}" CLIPBOARD_CMD="printf '%s' '$1'" bash "$SCRIPT" --yes 2>&1; }

reset_env
out="$(run 'postgresql://a:b@ep-old-prod.eu-central-1.aws.neon.tech/neondb')"; [[ "$out" == *"SAME database host"* ]] && ok "refuses the same host (pooled vs direct counts as same)" || bad "same host not refused"
out="$(run 'hello')"; [[ "$out" == *"does not hold a Postgres"* ]] && ok "refuses a non-URL clipboard" || bad "non-URL accepted"
out="$(run 'postgresql://a:b@example.com/db')"; [[ "$out" == *"not a Neon host"* ]] && ok "refuses a non-Neon host" || bad "non-Neon accepted"
grep -q 'ep-old-prod' "$ENVF" && ok "env untouched after refusals" || bad "env changed by a refusal"

out="$(run 'postgresql://dev:SECRETPW123@ep-new-dev-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require')"
[[ "$out" != *SECRETPW123* ]] && ok "password never printed" || bad "password leaked to output"
grep -q '^JWT_SECRET=keepme$' "$ENVF" && ok "other variables preserved" || bad "other variables lost"
grep -q '^APP_ENV=development$' "$ENVF" && ok "APP_ENV=development written" || bad "APP_ENV missing"
grep -q 'ep-new-dev' "$ENVF" && ok "new URL written" || bad "new URL missing"
! grep -q 'ep-old-prod' "$ENVF" && ok "old production URL removed from the file" || bad "old URL still present"
[[ "$(stat -f '%Lp' "$ENVF" 2>/dev/null || stat -c '%a' "$ENVF")" == "600" ]] && ok "file mode 600" || bad "file mode not 600"
[[ "$(grep -c '^DATABASE_URL=' "$ENVF")" == "1" ]] && ok "exactly one DATABASE_URL line" || bad "duplicate DATABASE_URL"

# --- the root .env (docker-compose) is switched too, but only when it already defines DATABASE_URL
ROOTF="$T/root-env"
reset_env; printf 'FOO=bar\nDATABASE_URL=postgresql://u:p@ep-old-prod.eu-central-1.aws.neon.tech/neondb\n' > "$ROOTF"
out="$(ROOT_ENV_FILE="$ROOTF" run 'postgresql://dev:SECRETPW123@ep-new-dev-pooler.eu-central-1.aws.neon.tech/neondb')"
grep -q 'ep-new-dev' "$ROOTF" && ! grep -q 'ep-old-prod' "$ROOTF" && grep -q '^FOO=bar$' "$ROOTF" && ok "root .env switched, other vars kept" || bad "root .env not switched correctly"
[[ "$out" != *SECRETPW123* ]] && ok "password not printed (root .env case)" || bad "password leaked (root .env case)"
reset_env; printf 'FOO=bar\n' > "$ROOTF"
ROOT_ENV_FILE="$ROOTF" run 'postgresql://dev:pw@ep-new-dev.eu-central-1.aws.neon.tech/neondb' >/dev/null
[[ "$(cat "$ROOTF")" == "FOO=bar" ]] && ok "root .env without DATABASE_URL left untouched" || bad "root .env modified although it had no DATABASE_URL"
ROOT_ENV_FILE="$T/does-not-exist" run 'postgresql://dev:pw@ep-new-dev.eu-central-1.aws.neon.tech/neondb' >/dev/null; [[ -f "$T/does-not-exist" ]] && bad "root .env created from nothing" || ok "missing root .env is not created"

rm -rf "$T"; [[ $fail -eq 0 ]] && echo "set-dev-db selftest ok" || { echo "set-dev-db selftest FAILED"; exit 1; }
