#!/usr/bin/env bash
# Push wp-content/uploads from local to remote. Mirrors by default (--delete) —
# local is treated as the thing being published, same direction as deploy.sh.
#
# Shows a dry run first; files it replaces or deletes go to ~/.brmbh-backups/ on the server.
#
# Blocked when CANONICAL_ENV=remote (remote is source of truth) — same guard
# as db-push.sh, since a client entering content directly on remote is exactly
# the scenario --delete would silently wipe.
#
# Usage:
#   source tools/env/staging.env && ./tools/uploads-push.sh
#
# --dry-run prints the plan and stops. SKIP_CONFIRM=1 skips the prompt (agents after the user said yes, CI).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/remote.sh"
# The CLI passes BRMBH_THEME_DIR; guessing from SCRIPT_DIR is only right for a theme-local tools/ copy.
THEME_DIR="${BRMBH_THEME_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_UPLOADS_DIR="$LOCAL_WP_PATH/wp-content/uploads"

for var in SSH_TARGET REMOTE_WP_PATH; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set." >&2
    echo "Run it through the CLI: npx brmbh uploads push <env>" >&2
    exit 1
  fi
done

if [[ "${CANONICAL_ENV:-remote}" == "remote" ]]; then
  echo "" >&2
  echo "❌  uploads-push blocked — CANONICAL_ENV=remote" >&2
  echo "   The remote ($REMOTE_URL) is the source of truth." >&2
  echo "   To push up, set \"canonical\": \"local\" on this environment in brmbh.json." >&2
  echo "" >&2
  exit 1
fi


DRY_RUN=""
RUN_EXCLUDES=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --exclude=*) RUN_EXCLUDES+=("$arg") ;;
  esac
done

EXCLUDE_ARGS=()
if [[ -n "${UPLOADS_EXCLUDE:-}" ]]; then
  IFS=',' read -ra _excludes <<< "$UPLOADS_EXCLUDE"
  for pattern in "${_excludes[@]}"; do
    [[ -n "$pattern" ]] && EXCLUDE_ARGS+=(--exclude="$pattern")
  done
fi
EXCLUDE_ARGS+=("${RUN_EXCLUDES[@]}")

REMOTE_UPLOADS_DIR="$(ssh "$SSH_TARGET" "cd $RWP && wp eval 'echo WP_CONTENT_DIR;' --allow-root 2>/dev/null" || echo "$REMOTE_WP_PATH/wp-content")/uploads"

echo ""
echo "--- Uploads sync: local → remote (mirror) ---"
echo ""
echo "Local uploads:  $LOCAL_UPLOADS_DIR"
echo "Remote uploads: $SSH_TARGET:$REMOTE_UPLOADS_DIR"
[[ ${#EXCLUDE_ARGS[@]} -gt 0 ]] && echo "Excluding: ${EXCLUDE_ARGS[*]#--exclude=}"
echo ""

# 1. Dry run: what would be new, replaced and deleted on the server
PLAN="$(rsync "${RSYNC_REMOTE[@]}" -rltz --delete -n --itemize-changes "${EXCLUDE_ARGS[@]}" "$LOCAL_UPLOADS_DIR/" "$SSH_TARGET:$(rpath "$REMOTE_UPLOADS_DIR")/")"
N_NEW=$(printf '%s\n' "$PLAN" | grep -cE '^[<>]f\+' || true)
N_CHANGED=$(printf '%s\n' "$PLAN" | grep -E '^[<>]f' | grep -cvE '^[<>]f\+' || true)
N_DELETED=$(printf '%s\n' "$PLAN" | grep -E '^\*deleting' | grep -cv '/$' || true)
echo "Plan: $N_NEW new · $N_CHANGED replaced · $N_DELETED deleted on the server"
printf '%s\n' "$PLAN" | grep -E '^\*deleting' | grep -v '/$' | head -20 | sed 's/^\*deleting */  - /'
if [[ $((N_NEW + N_CHANGED + N_DELETED)) -eq 0 ]]; then
  echo "✅ Nothing to push: the server already has these uploads."
  exit 0
fi
if [[ -n "$DRY_RUN" ]]; then
  echo "Dry run: nothing was sent."
  exit 0
fi

# 2. Confirm
if [[ -z "${SKIP_CONFIRM:-}" ]]; then
  read -p "Push? Replaced and deleted files are kept in a backup on the server. (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

# 3. Send; every file rsync replaces or deletes is moved into a backup folder first
REMOTE_HOME="$(ssh "$SSH_TARGET" 'echo $HOME')"
BACKUP_DIR="$REMOTE_HOME/.brmbh-backups/uploads-${BRMBH_ENV:-remote}-before-push-$(date +%Y%m%d-%H%M%S)"
rsync "${RSYNC_REMOTE[@]}" -rltz --delete --backup --backup-dir="$(rpath "$BACKUP_DIR")" "${EXCLUDE_ARGS[@]}" \
  "$LOCAL_UPLOADS_DIR/" \
  "$SSH_TARGET:$(rpath "$REMOTE_UPLOADS_DIR")/"

echo ""
echo "✅ Uploads pushed to $REMOTE_URL."
if [[ $((N_CHANGED + N_DELETED)) -gt 0 ]]; then
  echo "   Replaced and deleted files: $SSH_TARGET:$BACKUP_DIR"
fi
