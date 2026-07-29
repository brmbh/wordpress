#!/usr/bin/env bash
# Push wp-content/uploads from local to remote. Mirrors by default (--delete) —
# local is treated as the thing being published, same direction as deploy.sh.
#
# Blocked when CANONICAL_ENV=remote (remote is source of truth) — same guard
# as db-push.sh, since a client entering content directly on remote is exactly
# the scenario --delete would silently wipe.
#
# Usage:
#   source tools/env/staging.env && ./tools/uploads-push.sh
#
# Set SKIP_CONFIRM=1 to suppress the confirmation prompt (CI/automation).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_UPLOADS_DIR="$LOCAL_WP_PATH/wp-content/uploads"

for var in SSH_TARGET REMOTE_WP_PATH; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set." >&2
    echo "Source an env file first: source tools/env/staging.env && ./tools/uploads-push.sh" >&2
    exit 1
  fi
done

if [[ "${CANONICAL_ENV:-remote}" == "remote" ]]; then
  echo "" >&2
  echo "❌  uploads-push blocked — CANONICAL_ENV=remote" >&2
  echo "   The remote ($REMOTE_URL) is the source of truth." >&2
  echo "   To push local uploads up, set CANONICAL_ENV=local in your env file." >&2
  echo "" >&2
  exit 1
fi

if [[ -z "${SKIP_CONFIRM:-}" ]]; then
  echo "⚠️  This will mirror local wp-content/uploads to the remote — files present"
  echo "   remotely but not locally will be DELETED there."
  echo "   Remote: $SSH_TARGET:$REMOTE_WP_PATH"
  read -p "Are you sure? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

EXCLUDE_ARGS=()
if [[ -n "${UPLOADS_EXCLUDE:-}" ]]; then
  IFS=',' read -ra _excludes <<< "$UPLOADS_EXCLUDE"
  for pattern in "${_excludes[@]}"; do
    [[ -n "$pattern" ]] && EXCLUDE_ARGS+=(--exclude="$pattern")
  done
fi

REMOTE_UPLOADS_DIR="$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp eval 'echo WP_CONTENT_DIR;' --allow-root 2>/dev/null" || echo "$REMOTE_WP_PATH/wp-content")/uploads"

echo ""
echo "--- Uploads sync: local → remote (mirror) ---"
echo ""
echo "Local uploads:  $LOCAL_UPLOADS_DIR"
echo "Remote uploads: $SSH_TARGET:$REMOTE_UPLOADS_DIR"
[[ ${#EXCLUDE_ARGS[@]} -gt 0 ]] && echo "Excluding: $UPLOADS_EXCLUDE"
echo ""

rsync -avz --delete "${EXCLUDE_ARGS[@]}" \
  "$LOCAL_UPLOADS_DIR/" \
  "$SSH_TARGET:$REMOTE_UPLOADS_DIR/"

echo ""
echo "✅ Uploads pushed to $REMOTE_URL."
