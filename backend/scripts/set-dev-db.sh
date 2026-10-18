#!/usr/bin/env bash
# One-command, secret-safe switch of backend/.env to the DEVELOPMENT Neon branch.
#   1. In the Neon console open branch "development" → Connect → copy the connection string.
#   2. Run:  npm run env:set-dev-db --prefix backend
# The URL is read from your clipboard and written straight into backend/.env — it is never printed, never
# passed on a command line, and the clipboard is cleared afterwards. Run it yourself, in your own terminal.
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/.." && pwd)/.env}"
CLIP_CMD="${CLIPBOARD_CMD:-pbpaste}"
ASSUME_YES=0; [[ "${1:-}" == "--yes" ]] && ASSUME_YES=1

die() { printf '\n✖ %s\n\n' "$1" >&2; exit 1; }

url="$(bash -c "$CLIP_CMD" | tr -d '[:space:]')"
re='^postgres(ql)?://([^:@/]+):([^@]+)@([^/:?]+)(:[0-9]+)?/([^?]+)(\?.*)?$'
[[ "$url" =~ $re ]] || die "The clipboard does not hold a Postgres connection string (postgresql://user:pass@host/db). Copy it from Neon → Connect."
new_host="${BASH_REMATCH[4]}"; new_db="${BASH_REMATCH[6]}"
[[ "$new_host" == *.neon.tech || "${ALLOW_NON_NEON:-0}" == "1" ]] || die "Host '$new_host' is not a Neon host. Copy the connection string from the Neon console."

norm() { sed -E 's/-pooler//'; }   # pooled and direct endpoints are the same compute
cur_host=""
if [[ -f "$ENV_FILE" ]]; then
  cur_url="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'[:space:]" || true)"
  [[ "$cur_url" =~ $re ]] && cur_host="${BASH_REMATCH[4]}"
fi
if [[ -n "$cur_host" && "$(printf %s "$cur_host" | norm)" == "$(printf %s "$new_host" | norm)" ]]; then
  die "The clipboard points at the SAME database host as the current backend/.env ($cur_host). That is either already the dev branch, or you copied the production one. Nothing changed."
fi

printf '\nbackend/.env will switch to the DEVELOPMENT database:\n  current : %s\n  new     : %s / %s   (APP_ENV=development)\n' "${cur_host:-<none>}" "$new_host" "$new_db"
printf '\nThe current DATABASE_URL line is REMOVED from this file. Make sure the production URL is kept where it belongs\n(Fly secrets / Infisical prod) — it is not stored anywhere on this machine after this.\n\n'
if [[ $ASSUME_YES -ne 1 ]]; then read -r -p "Continue? [y/N] " ans; [[ "$ans" =~ ^[Yy]$ ]] || die "Cancelled — nothing changed."; fi

tmp="$(mktemp)"
{ [[ -f "$ENV_FILE" ]] && { grep -Ev '^(DATABASE_URL|APP_ENV)=' "$ENV_FILE" || true; }
  printf 'APP_ENV=development\nDATABASE_URL=%s\n' "$url"; } > "$tmp"
chmod 600 "$tmp"; mv "$tmp" "$ENV_FILE"

# docker-compose substitutes ${DATABASE_URL} from the REPO-ROOT .env, so a stale production URL there would keep the
# container on production even after backend/.env is switched. Update it too — but only if it already defines one.
ROOT_ENV_FILE="${ROOT_ENV_FILE:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
root_updated=0
if [[ -f "$ROOT_ENV_FILE" ]] && grep -q '^DATABASE_URL=' "$ROOT_ENV_FILE"; then
  tmp2="$(mktemp)"
  { grep -Ev '^(DATABASE_URL|APP_ENV)=' "$ROOT_ENV_FILE" || true
    printf 'APP_ENV=development\nDATABASE_URL=%s\n' "$url"; } > "$tmp2"
  chmod 600 "$tmp2"; mv "$tmp2" "$ROOT_ENV_FILE"; root_updated=1
fi

[[ "$CLIP_CMD" == "pbpaste" ]] && { pbcopy </dev/null || true; }
printf '✔ backend/.env now targets the development database (%s).\n' "$new_host"
[[ $root_updated -eq 1 ]] && printf '✔ the root .env (read by docker-compose) was switched too.\n'
printf 'Clipboard cleared.\n  Note: if `infisical run` provides DATABASE_URL, it OVERRIDES these files — set DATABASE_URL and APP_ENV=development\n  in Infisical'"'"'s dev environment as well.\n  Next: npm run schema:sync --prefix backend   (then restart the backend container; its first log lines show the database host)\n'
