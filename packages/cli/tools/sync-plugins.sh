#!/usr/bin/env bash
# Sync active plugins from local to production.
#
# Strategy:
#   1. Get list of active plugins from local WP
#   2. For each plugin: attempt wp plugin install (works for wp.org plugins)
#   3. If install fails or plugin is premium (not on wp.org), rsync the
#      plugin directory directly from local to production
#   4. Activate all synced plugins on production
#
# Usage:
#   source tools/env/staging.env && ./tools/sync-plugins.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_WP_CLI="${LOCAL_WP_CLI:-wp}"
LOCAL_PLUGINS_DIR="$LOCAL_WP_PATH/wp-content/plugins"

for var in SSH_TARGET REMOTE_WP_PATH; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set." >&2
    echo "Run: source tools/env/staging.env && ./tools/sync-plugins.sh" >&2
    exit 1
  fi
done

REMOTE_PLUGINS_DIR="$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp eval 'echo WP_PLUGIN_DIR;' --allow-root 2>/dev/null" || echo "$REMOTE_WP_PATH/wp-content/plugins")"

echo ""
echo "--- Plugin sync: local → production ---"
echo ""
echo "Local plugins:  $LOCAL_PLUGINS_DIR"
echo "Remote plugins: $SSH_TARGET:$REMOTE_PLUGINS_DIR"
echo ""

ACTIVE_PLUGINS=$($LOCAL_WP_CLI plugin list --status=active --field=name --path="$LOCAL_WP_PATH" 2>/dev/null)
PLUGIN_COUNT=$(echo "$ACTIVE_PLUGINS" | grep -c .)
echo "Active plugins locally: $PLUGIN_COUNT"
echo ""

RSYNCED=()
INSTALLED=()
FAILED=()

while IFS= read -r plugin; do
  [[ -z "$plugin" ]] && continue
  echo "→ $plugin"

  # Try wp plugin install from wp.org first
  INSTALL_OUT=$(ssh "$SSH_TARGET" \
    "wp plugin install '$plugin' --path=$REMOTE_WP_PATH --allow-root 2>&1" || true)

  if echo "$INSTALL_OUT" | grep -qE "^Success:|already installed"; then
    ssh "$SSH_TARGET" \
      "wp plugin activate '$plugin' --path=$REMOTE_WP_PATH --allow-root 2>/dev/null" || true
    INSTALLED+=("$plugin")
    echo "  ✅ installed from wp.org"
  else
    # Premium or unknown — rsync the directory directly
    LOCAL_DIR="$LOCAL_PLUGINS_DIR/$plugin"
    if [[ -d "$LOCAL_DIR" ]]; then
      rsync -az --delete \
        "$LOCAL_DIR/" \
        "$SSH_TARGET:$REMOTE_PLUGINS_DIR/$plugin/"
      ssh "$SSH_TARGET" \
        "wp plugin activate '$plugin' --path=$REMOTE_WP_PATH --allow-root 2>/dev/null" || true
      RSYNCED+=("$plugin")
      echo "  ✅ rsynced (premium/not on wp.org)"
    else
      FAILED+=("$plugin")
      echo "  ❌ not found locally at $LOCAL_DIR"
    fi
  fi
  echo ""

done <<< "$ACTIVE_PLUGINS"

echo "--- Summary ---"
echo ""
[[ ${#INSTALLED[@]} -gt 0 ]] && echo "Installed from wp.org (${#INSTALLED[@]}): ${INSTALLED[*]}"
[[ ${#RSYNCED[@]} -gt 0 ]]   && echo "Rsynced directly    (${#RSYNCED[@]}):   ${RSYNCED[*]}"
[[ ${#FAILED[@]} -gt 0 ]]    && echo "❌ Failed           (${#FAILED[@]}):   ${FAILED[*]}"
echo ""
echo "Done. Run ./tools/db-verify.sh to confirm everything is healthy."
