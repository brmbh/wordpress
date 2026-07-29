#!/usr/bin/env bash
# Push local database to remote. OVERWRITES the remote database.
#
# Blocked when CANONICAL_ENV=remote (remote is source of truth).
# Set CANONICAL_ENV=local in your env file to enable.
#
# What this does:
#   1. Export local DB to a temp file
#   2. Transfer to remote via SSH
#   3. Import on remote
#   4. Search-replace all URLs (http + https variants, convergence pass)
#   5. Fix siteurl + home options
#   6. Activate remote theme
#   7. Flush object cache
#   8. Run any pending DB schema upgrades on remote
#
# Usage:
#   source tools/env/staging.env && ./tools/db-push.sh
#   source tools/env/production.env && ./tools/db-push.sh
#
# Set SKIP_CONFIRM=1 to suppress the confirmation prompt (CI/automation).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-lib.sh"

db_check_env
db_check_canonical_for_push

if [[ -z "${SKIP_CONFIRM:-}" ]]; then
  echo "⚠️  This will OVERWRITE the remote database with your local database."
  echo "   Remote URL: $REMOTE_URL"
  read -p "Are you sure? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

if ! db_check_connections "Pre-flight check"; then
  exit 1
fi

echo "🚀 Pushing local DB to remote ($REMOTE_URL)..."
TMP_DUMP=$(mktemp /tmp/wp-sync-XXXXXX.sql)
$LOCAL_WP_CLI db export "$TMP_DUMP" --path="$LOCAL_WP_PATH"
ssh "$SSH_TARGET" "cat > /tmp/wp-sync-import.sql" < "$TMP_DUMP"
rm -f "$TMP_DUMP"
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp db import /tmp/wp-sync-import.sql --allow-root && rm /tmp/wp-sync-import.sql"

echo ""
echo "🔁 Running URL search-replace (with convergence pass)..."
remote_search_replace "$LOCAL_URL" "$REMOTE_URL"

echo ""
echo "🔧 Fixing siteurl, home, theme and cache..."
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp option update siteurl '$REMOTE_URL' --allow-root"
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp option update home '$REMOTE_URL' --allow-root"
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp theme activate '$REMOTE_THEME' --allow-root"
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp cache flush --allow-root"

echo ""
echo "🗄️  Running any pending DB schema upgrades on remote..."
ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp core update-db --allow-root 2>&1" \
  | grep -E "Success|already|Error" || true

echo ""
echo "✅ Push complete. Remote DB ($REMOTE_URL), URLs and schema are reconciled."
