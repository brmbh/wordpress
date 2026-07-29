#!/usr/bin/env bash
# Pull wp-content/uploads from remote to local.
#
# Additive by default (never deletes local-only files). Pass --delete to
# mirror remote exactly (removes local files not present on remote).
#
# Usage:
#   source tools/env/staging.env && ./tools/uploads-pull.sh
#   source tools/env/staging.env && ./tools/uploads-pull.sh --delete

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_UPLOADS_DIR="$LOCAL_WP_PATH/wp-content/uploads"

for var in SSH_TARGET REMOTE_WP_PATH; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set." >&2
    echo "Source an env file first: source tools/env/staging.env && ./tools/uploads-pull.sh" >&2
    exit 1
  fi
done

DELETE_FLAG=""
if [[ "${1:-}" == "--delete" ]]; then
  DELETE_FLAG="--delete"
fi

# UPLOADS_EXCLUDE is an optional comma-separated list set in the env file,
# e.g. export UPLOADS_EXCLUDE="cache/,some-backup-plugin/" — for anything a
# given project's remote stuffs into wp-content/uploads that shouldn't sync.
EXCLUDE_ARGS=()
if [[ -n "${UPLOADS_EXCLUDE:-}" ]]; then
  IFS=',' read -ra _excludes <<< "$UPLOADS_EXCLUDE"
  for pattern in "${_excludes[@]}"; do
    [[ -n "$pattern" ]] && EXCLUDE_ARGS+=(--exclude="$pattern")
  done
fi

REMOTE_UPLOADS_DIR="$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp eval 'echo WP_CONTENT_DIR;' --allow-root 2>/dev/null" || echo "$REMOTE_WP_PATH/wp-content")/uploads"

echo ""
echo "--- Uploads sync: remote → local ---"
echo ""
echo "Remote uploads: $SSH_TARGET:$REMOTE_UPLOADS_DIR"
echo "Local uploads:  $LOCAL_UPLOADS_DIR"
[[ -n "$DELETE_FLAG" ]] && echo "Mode: mirror (--delete)" || echo "Mode: additive (no deletions)"
[[ ${#EXCLUDE_ARGS[@]} -gt 0 ]] && echo "Excluding: $UPLOADS_EXCLUDE"
echo ""

mkdir -p "$LOCAL_UPLOADS_DIR"

rsync -avz $DELETE_FLAG "${EXCLUDE_ARGS[@]}" \
  "$SSH_TARGET:$REMOTE_UPLOADS_DIR/" \
  "$LOCAL_UPLOADS_DIR/"

echo ""
echo "✅ Uploads pulled. Run wp media regenerate --path=\"$LOCAL_WP_PATH\" if thumbnails look stale."
