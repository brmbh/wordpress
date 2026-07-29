#!/usr/bin/env bash
# Test local and production DB connections. Makes no changes.
#
# Usage:
#   source tools/env/staging.env && ./tools/db-verify.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-lib.sh"

db_check_env

if db_check_connections "Verify only (no changes)"; then
  echo "Safe to run: ./tools/db-pull.sh   or   ./tools/db-push.sh"
else
  exit 1
fi
