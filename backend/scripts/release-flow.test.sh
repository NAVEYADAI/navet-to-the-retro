#!/usr/bin/env bash
# Integration test of the production schema flow (plan → approve → gate → release), using the ISOLATED test DB
# (postgres-test, localhost:5433) as a stand-in for production. Needs `docker compose up -d postgres-test`.
#   npm run test:release-flow --prefix backend
# It mutates only the test DB, and restores it at the end. Approvals/fixes go to a temp dir, never the repo's.
set -uo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"; export SCHEMA_APPROVALS_DIR="$T/approvals" SCHEMA_FIXES_DIR="$T/fixes"; mkdir -p "$SCHEMA_APPROVALS_DIR" "$SCHEMA_FIXES_DIR"
export SCHEMA_SYNC_ALLOW_LOCAL=1 # lets the "prod" commands accept the local test DB — self-tests only
fail=0
ok()  { printf '  ✔ %s\n' "$1"; }
bad() { printf '  ✖ %s\n' "$1"; fail=1; }
S() { npx dotenv -e .env.test -- sh -c "$1" 2>&1; }          # run a command with the test DB as DATABASE_URL
SYNC() { S "PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=$1 node scripts/schema-sync.js $2"; }
id12() { echo "$1" | grep -oE 'Plan id: [0-9a-f]{12}' | head -1 | awk '{print $3}'; }

BASE=prisma/schema.prisma
variant() { python3 - "$1" "$2" <<'PY'
import sys
name, mode = sys.argv[1], sys.argv[2]
s = open('prisma/schema.prisma').read()
anchor = "  lastName                  String?\n"
if mode == 'add-nullable': s = s.replace(anchor, anchor + "  probeNote                 String?\n", 1)
elif mode == 'add-other':  s = s.replace(anchor, anchor + "  probeOther                String?\n", 1)
elif mode == 'drop':       s = s.replace(anchor, "", 1)
open(name, 'w').write(s)
PY
}
# Remove what the scenarios create, THEN restore the real schema — a push refuses to run while extra tables/columns
# exist (it would have to drop them), which is exactly the protection we want in production too.
reset_test_db() {
  S "echo 'DROP TABLE IF EXISTS \"_bak_User_lastName\"; ALTER TABLE \"User\" DROP COLUMN IF EXISTS \"probeNote\"; ALTER TABLE \"User\" DROP COLUMN IF EXISTS \"probeOther\";' | npx prisma db execute --stdin --schema $BASE" >/dev/null
  S "node scripts/schema-sync.js push-test" >/dev/null
}
cleanup() { reset_test_db; rm -f prisma/schema.rf-*.prisma; rm -rf "$T"; }
trap cleanup EXIT

echo "== precondition"
S "node scripts/schema-sync.js push-test" >/dev/null
out="$(S 'node scripts/schema-sync.js check-test')"; [[ "$out" == *"is in sync with the schema"* ]] && ok "test DB starts in sync" || { bad "test DB not in sync: $out"; exit 1; }

echo "== 1. a safe, additive change"
variant prisma/schema.rf-a.prisma add-nullable
out="$(SYNC prisma/schema.rf-a.prisma plan-prod)"; [[ "$out" == *"risk"*"SAFE"* ]] && ok "plan-prod classifies it SAFE" || bad "plan not SAFE: $out"
pid="$(id12 "$out")"; [[ -n "$pid" ]] && ok "plan has an id ($pid)" || bad "no plan id"
out="$(S "SCHEMA_PATH=prisma/schema.rf-a.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -ne 0 && "$out" == *"NOT APPROVED"* ]] && ok "release REFUSES without an approval (deploy would stop)" || bad "release did not refuse (rc=$rc)"
out="$(S 'node scripts/schema-sync.js check-test' )"; [[ "$out" == *"is in sync with the schema"* ]] && ok "…and the database was not touched" || bad "DB changed by a refused release"
SYNC prisma/schema.rf-a.prisma gate-prod >/dev/null; [[ $? -ne 0 ]] && ok "gate-prod stops an unapproved change" || bad "gate-prod let it through"
out="$(SCHEMA_APPROVE_CONFIRM='nope' SYNC prisma/schema.rf-a.prisma approve-prod)"; rc=$?
[[ $rc -ne 0 && ! -e "$SCHEMA_APPROVALS_DIR/$pid.json" ]] && ok "a wrong confirmation writes nothing" || bad "approval written without the right phrase"
out="$(S "SCHEMA_APPROVE_CONFIRM='APPLY $pid' PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=prisma/schema.rf-a.prisma node scripts/schema-sync.js approve-prod")"
[[ -e "$SCHEMA_APPROVALS_DIR/$pid.json" ]] && ok "approval written for exactly that plan" || bad "approval missing: $out"
SYNC prisma/schema.rf-a.prisma gate-prod >/dev/null; [[ $? -eq 0 ]] && ok "gate-prod now passes (approved)" || bad "gate-prod still blocks an approved change"
out="$(S "SCHEMA_PATH=prisma/schema.rf-a.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -eq 0 && "$out" == *"applied"* ]] && ok "release applies the approved plan" || bad "release failed (rc=$rc): $out"
out="$(S "SCHEMA_PATH=prisma/schema.rf-a.prisma node scripts/schema-sync.js check-test")"; [[ "$out" == *"is in sync with the schema"* ]] && ok "database now matches the schema" || bad "DB does not match after release"
out="$(S "SCHEMA_PATH=prisma/schema.rf-a.prisma node scripts/schema-sync.js release")"; [[ $? -eq 0 && "$out" == *"nothing to apply"* ]] && ok "a second release is a no-op" || bad "second release not a no-op"

echo "== 2. an approval covers only the exact SQL it was written for"
reset_test_db
variant prisma/schema.rf-b.prisma add-other
out="$(S "SCHEMA_PATH=prisma/schema.rf-b.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -ne 0 && "$out" == *"NOT APPROVED"* ]] && ok "a different change is NOT covered by the earlier approval" || bad "approval leaked to another change (rc=$rc)"

echo "== 3. a destructive change with a reviewed fix"
reset_test_db
variant prisma/schema.rf-c.prisma drop
out="$(SYNC prisma/schema.rf-c.prisma plan-prod)"; pid="$(id12 "$out")"
[[ "$out" == *"DESTRUCTIVE"* && "$out" == *"_bak_User_lastName"* ]] && ok "plan is DESTRUCTIVE and drafts a backup fix" || bad "plan missing risk/fix: $out"
printf 'CREATE TABLE "_bak_User_lastName" AS SELECT "id", "lastName" FROM "User" WHERE "<col>" IS NULL;\n' > "$SCHEMA_FIXES_DIR/$pid.pre.sql"
out="$(S "SCHEMA_APPROVE_CONFIRM='APPLY $pid' PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=prisma/schema.rf-c.prisma node scripts/schema-sync.js approve-prod")"; rc=$?
[[ $rc -ne 0 && "$out" == *"unresolved placeholders"* ]] && ok "approve refuses a fix draft with <placeholders> left" || bad "placeholder fix accepted (rc=$rc)"
printf 'CREATE TABLE "_bak_User_lastName" AS SELECT "id", "lastName" FROM "User";\n' > "$SCHEMA_FIXES_DIR/$pid.pre.sql"
S "SCHEMA_APPROVE_CONFIRM='APPLY $pid' PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=prisma/schema.rf-c.prisma node scripts/schema-sync.js approve-prod" >/dev/null
grep -q '_bak_User_lastName' "$SCHEMA_APPROVALS_DIR/$pid.json" && ok "the reviewed fix is stored inside the approval" || bad "fix not stored in approval"
out="$(S "SCHEMA_PATH=prisma/schema.rf-c.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -eq 0 ]] && ok "release applied fix + change" || bad "release failed (rc=$rc): $out"
out="$(S "echo 'SELECT count(*) FROM \"_bak_User_lastName\";' | npx prisma db execute --stdin --schema $BASE")"; [[ "$out" != *"does not exist"* && "$out" != *"rror"* ]] && ok "the backup table exists" || bad "backup table missing: $out"
out="$(S "SCHEMA_PATH=prisma/schema.rf-c.prisma node scripts/schema-sync.js check-test")"; [[ "$out" == *"is in sync with the schema"* ]] && ok "the column is gone, schema matches" || bad "schema mismatch after destructive release"

echo "== 4. all-or-nothing: a failing fix leaves the database untouched"
reset_test_db
out="$(S 'node scripts/schema-sync.js check-test')"; [[ "$out" == *"is in sync with the schema"* ]] && ok "test DB restored to the real schema" || bad "restore failed: $out"
variant prisma/schema.rf-d.prisma drop
out="$(SYNC prisma/schema.rf-d.prisma plan-prod)"; pid="$(id12 "$out")"
printf 'SELECT * FROM "TableThatDoesNotExist";\n' > "$SCHEMA_FIXES_DIR/$pid.pre.sql"
S "SCHEMA_APPROVE_CONFIRM='APPLY $pid' PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=prisma/schema.rf-d.prisma node scripts/schema-sync.js approve-prod" >/dev/null
out="$(S "SCHEMA_PATH=prisma/schema.rf-d.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -ne 0 ]] && ok "release fails when the fix fails" || bad "release succeeded despite a broken fix"
out="$(S "SCHEMA_PATH=$BASE node scripts/schema-sync.js check-test")"; [[ "$out" == *"is in sync with the schema"* ]] && ok "lastName column still exists — nothing was half-applied" || bad "partial change left behind: $out"

echo "== 5. tampering with an approval invalidates it"
variant prisma/schema.rf-e.prisma add-nullable
reset_test_db
out="$(SYNC prisma/schema.rf-e.prisma plan-prod)"; pid="$(id12 "$out")"
S "SCHEMA_APPROVE_CONFIRM='APPLY $pid' PROD_DATABASE_URL=\"\$DATABASE_URL\" SCHEMA_PATH=prisma/schema.rf-e.prisma node scripts/schema-sync.js approve-prod" >/dev/null
python3 - "$SCHEMA_APPROVALS_DIR/$pid.json" <<'PY'
import json, sys
p = sys.argv[1]; d = json.load(open(p)); d['sql'] = d['sql'].replace('probeNote', 'somethingElse'); json.dump(d, open(p, 'w'))
PY
out="$(S "SCHEMA_PATH=prisma/schema.rf-e.prisma node scripts/schema-sync.js release")"; rc=$?
[[ $rc -ne 0 && "$out" == *"NOT APPROVED"* ]] && ok "an edited approval file is rejected" || bad "tampered approval accepted (rc=$rc)"

[[ $fail -eq 0 ]] && echo "release-flow test ok" || { echo "release-flow test FAILED"; exit 1; }
