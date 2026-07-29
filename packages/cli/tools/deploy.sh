#!/usr/bin/env bash
# Deploy theme from local working tree to remote via rsync over SSH.
#
# Requires a whitelisted IP — run from a machine with SSH access to the server.
# GitHub Actions cannot be used (server firewall blocks their IPs).
#
# Usage:
#   source tools/env/staging.env && ./tools/deploy.sh
#   source tools/env/production.env && ./tools/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

for var in SSH_TARGET REMOTE_WP_PATH REMOTE_THEME REMOTE_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set. Source an env file first." >&2
    echo "  source tools/env/staging.env && ./tools/deploy.sh" >&2
    exit 1
  fi
done

REMOTE_THEME_PATH="$REMOTE_WP_PATH/wp-content/themes/$REMOTE_THEME"

echo ""
echo "🚀 Deploying theme to $REMOTE_URL"
echo "   $SSH_TARGET:$REMOTE_THEME_PATH"
echo ""

rsync -avz --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='node_modules' \
  --exclude='vendor' \
  --exclude='tools' \
  --exclude='assets/src' \
  --exclude='.DS_Store' \
  --exclude='.claude' \
  --exclude='.cursor' \
  --exclude='.windsurf' \
  --exclude='.vscode' \
  --exclude='.debug-screenshots' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='webpack.config.js' \
  --exclude='.brmbh-config.json' \
  --exclude='plugins.txt' \
  "$THEME_DIR/" \
  "$SSH_TARGET:$REMOTE_THEME_PATH/"

echo ""
echo "🔄 Flushing cache..."
ssh "$SSH_TARGET" "wp cache flush --path=$REMOTE_WP_PATH 2>/dev/null || true"

echo ""
echo "✅ Deploy complete → $REMOTE_URL"
