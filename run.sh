#!/usr/bin/env bash
# One-command launcher for the mortgage-analysis dashboard.
#
#   ./run.sh            start on http://127.0.0.1:5173
#   ./run.sh --mobile   also reachable from your phone (prints a QR code)
#   ./run.sh --doctor   run the environment checks and exit
#   ./run.sh --smoke    verify the skill loads and Claude is logged in, then exit
#
# First run installs the npm dependencies; later runs skip straight to starting.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$HERE/web"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$WEB" ] || fail "web/ not found next to run.sh — run this from the repository."

# --- Node ------------------------------------------------------------------
command -v node >/dev/null 2>&1 || fail \
"Node.js is not installed. Install Node 20+ first:
  macOS:  brew install node        (or https://nodejs.org)
  Linux:  https://nodejs.org/en/download"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail \
"Node $(node --version) is too old — this needs Node 20 or newer."

cd "$WEB"

# --- Dependencies (first run only) -----------------------------------------
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  say "Installing dependencies (first run only)…"
  npm install
fi

# --- Modes -----------------------------------------------------------------
case "${1:-}" in
  --doctor) exec npm run doctor ;;
  --smoke)  exec npm run smoke ;;
  --mobile) MODE=mobile ;;
  "")       MODE=local ;;
  *)        fail "Unknown option: $1  (use --mobile, --doctor, or --smoke)" ;;
esac

# --- Preflight -------------------------------------------------------------
say "Checking the environment…"
if ! npm run --silent doctor; then
  fail "Fix the ✗ items above, then run ./run.sh again.
The usual ones: 'claude' + /login for auth, 'brew install pandoc' for the PDF."
fi

# --- Start -----------------------------------------------------------------
if [ "$MODE" = mobile ]; then
  say "Starting in mobile mode — scan the QR code below from your phone."
  MORTGAGE_WEB_MOBILE=1 exec node dist/server.js
else
  say "Starting… open http://127.0.0.1:${MORTGAGE_WEB_PORT:-5173} (Ctrl-C stops it)."
  exec node dist/server.js
fi
