#!/usr/bin/env bash
# Pull remote database to local.
#
# What this does:
#   1. Export DB from remote (staging or production) via SSH
#   2. Import into local WordPress
#   3. Search-replace all URLs (http + https variants, convergence pass)
#   4. Fix siteurl + home options
#   5. Activate local theme
#   6. Flush object cache
#   7. Install the plugin versions the server runs (never newer ones)
#   8. Run any pending DB schema upgrades (core + plugins)
#   9. Run version drift check (local vs remote)
#
# Usage:
#   npx brmbh db pull <env>   (the CLI sets the variables from brmbh.json)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-lib.sh"

db_check_env

if ! db_check_connections "Pre-flight check"; then
  exit 1
fi

db_backup_local

echo "🔄 Pulling remote DB ($REMOTE_URL) to local..."
ssh "$SSH_TARGET" "cd $RWP && wp db export - --allow-root" \
  | $LOCAL_WP_CLI db import - --path="$LOCAL_WP_PATH"

echo ""
echo "🔁 Running URL search-replace (with convergence pass)..."
local_search_replace "$REMOTE_URL" "$LOCAL_URL"

echo ""
echo "🔧 Fixing siteurl, home, theme and cache..."
$LOCAL_WP_CLI option update siteurl "$LOCAL_URL" --path="$LOCAL_WP_PATH"
$LOCAL_WP_CLI option update home    "$LOCAL_URL" --path="$LOCAL_WP_PATH"
$LOCAL_WP_CLI theme activate "$LOCAL_THEME"      --path="$LOCAL_WP_PATH"
$LOCAL_WP_CLI cache flush                        --path="$LOCAL_WP_PATH"

echo ""
echo "🔌 Matching local plugin versions to the server..."
match_plugin_versions

echo ""
echo "🗄️  Running any pending DB schema upgrades (core + plugins)..."
$LOCAL_WP_CLI core update-db --path="$LOCAL_WP_PATH" 2>&1 \
  | grep -E "Success|already|Error" || true

echo ""
echo "✅ Pull complete. Local DB, URLs, plugins and schema are reconciled."

VCHECK="$SCRIPT_DIR/version-check.sh"
if [[ -x "$VCHECK" ]]; then
  echo ""
  echo "Running version drift check..."
  bash "$VCHECK" || true
fi
