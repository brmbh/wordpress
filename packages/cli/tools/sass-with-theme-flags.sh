#!/usr/bin/env bash
# Uses the project's local sass binary with Bootstrap 5.x deprecation silencing.
# A global sass on PATH may not recognise the same --silence-deprecation IDs.
# This script ships inside @brmbh/cli but operates on the *consuming theme*, so
# it must resolve paths from the invoking project, never from its own location.
# npm scripts run with cwd = the theme root; BRMBH_THEME_DIR overrides.
ROOT="${BRMBH_THEME_DIR:-$PWD}"
SASS_BIN="$ROOT/node_modules/.bin/sass"

if [ ! -x "$SASS_BIN" ]; then
  echo "sass not found at $SASS_BIN — run \`npm install\` in the theme directory." >&2
  exit 1
fi

exec "$SASS_BIN" \
  --load-path="$ROOT/assets/src/scss" \
  --load-path="$ROOT/my-acf-blocks" \
  --quiet-deps \
  --silence-deprecation=import \
  --silence-deprecation=global-builtin \
  --silence-deprecation=color-functions \
  --silence-deprecation=if-function \
  --silence-deprecation=function-units \
  --silence-deprecation=abs-percent \
  "$@"
