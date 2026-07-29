#!/usr/bin/env bash
# Shared library for DB sync scripts. Source this file — do not execute directly.
#
# Requires env vars (set via tools/env/*.env):
#   SSH_TARGET, REMOTE_WP_PATH, REMOTE_URL, LOCAL_URL,
#   LOCAL_THEME, REMOTE_THEME, LOCAL_WP_PATH, LOCAL_WP_CLI
#   CANONICAL_ENV — "local" (push allowed) | "remote" (push blocked, remote is truth)
#
# Usage in a script:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/db-lib.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_WP_CLI="${LOCAL_WP_CLI:-wp}"

# ── Validate required env vars ─────────────────────────────────────────────────

db_check_env() {
  for var in SSH_TARGET REMOTE_WP_PATH REMOTE_URL LOCAL_THEME REMOTE_THEME; do
    if [[ -z "${!var:-}" ]]; then
      echo "Error: $var is not set." >&2
      echo "Source an env file first: source tools/env/staging.env" >&2
      exit 1
    fi
  done

  if [[ -z "${LOCAL_URL:-}" ]]; then
    LOCAL_URL="http://localhost:8888"
    echo "LOCAL_URL not set, using default: $LOCAL_URL"
  fi

  CANONICAL_ENV="${CANONICAL_ENV:-remote}"
}

# Guard: block db-push when remote is the canonical source of truth.
db_check_canonical_for_push() {
  if [[ "${CANONICAL_ENV:-remote}" == "remote" ]]; then
    echo "" >&2
    echo "❌  db-push blocked — CANONICAL_ENV=remote" >&2
    echo "   The remote ($REMOTE_URL) is the source of truth." >&2
    echo "   To push local DB up, set CANONICAL_ENV=local in your env file." >&2
    echo "" >&2
    exit 1
  fi
}

# ── Connection check ───────────────────────────────────────────────────────────

db_check_connections() {
  local header="${1:-Checking database connections}"
  echo ""
  echo "--- $header ---"
  echo ""

  echo "[1/2] Local"
  echo "      Path: $LOCAL_WP_PATH"
  if $LOCAL_WP_CLI db check --path="$LOCAL_WP_PATH" --quiet 2>/dev/null; then
    local local_siteurl
    local_siteurl="$($LOCAL_WP_CLI option get siteurl --path="$LOCAL_WP_PATH" --quiet 2>/dev/null || true)"
    echo "      ✅ Local DB OK (siteurl: ${local_siteurl:-n/a})"
  else
    echo "      ❌ Local DB FAILED. Check wp-config.php and that MySQL is running."
    return 1
  fi

  echo ""
  echo "[2/2] Remote (${REMOTE_URL:-$SSH_TARGET})"
  echo "      SSH: $SSH_TARGET"
  echo "      Path: $REMOTE_WP_PATH"
  if ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp db check --allow-root --quiet" 2>/dev/null; then
    local remote_siteurl
    remote_siteurl="$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp option get siteurl --allow-root --quiet" 2>/dev/null || true)"
    echo "      ✅ Remote DB OK (siteurl: ${remote_siteurl:-n/a})"
  else
    echo "      ❌ Remote DB FAILED. Check SSH key, REMOTE_WP_PATH, and wp on server."
    return 1
  fi

  echo ""
  if [[ "${LOCAL_THEME:-}" != "${REMOTE_THEME:-}" ]]; then
    echo "⚠️  Theme name mismatch:"
    echo "      Local theme:  ${LOCAL_THEME:-not set}"
    echo "      Remote theme: ${REMOTE_THEME:-not set}"
    echo "      Scripts activate the correct theme automatically after import."
  fi
  echo ""
  echo "--- Both connections OK ---"
  echo ""
  return 0
}

# ── Local search-replace (with http/https variant + convergence pass) ──────────
# Always uses --skip-plugins --skip-themes to prevent memory exhaustion from
# heavy plugins (e.g. TranslatePress) that can crash WP-CLI mid-replace.

local_search_replace() {
  local from="$1" to="$2"
  local from_alt

  echo "  → Replacing: $from → $to"
  $LOCAL_WP_CLI search-replace "$from" "$to" \
    --path="$LOCAL_WP_PATH" --all-tables --skip-plugins --skip-themes 2>/dev/null \
    | grep -E "^Success:|Replacements" || true

  if [[ "$from" == https://* ]]; then
    from_alt="${from/https:\/\//http:\/\/}"
  else
    from_alt="${from/http:\/\//https:\/\/}"
  fi
  if [[ "$from_alt" != "$from" ]]; then
    echo "  → Replacing: $from_alt → $to"
    $LOCAL_WP_CLI search-replace "$from_alt" "$to" \
      --path="$LOCAL_WP_PATH" --all-tables --skip-plugins --skip-themes 2>/dev/null \
      | grep -E "^Success:|Replacements" || true
  fi

  echo "  → Convergence pass..."
  $LOCAL_WP_CLI search-replace "$from" "$to" \
    --path="$LOCAL_WP_PATH" --all-tables --skip-plugins --skip-themes --report-changed-only 2>/dev/null \
    | grep -E "^Success:|Replacements" || true
  if [[ "$from_alt" != "$from" ]]; then
    $LOCAL_WP_CLI search-replace "$from_alt" "$to" \
      --path="$LOCAL_WP_PATH" --all-tables --skip-plugins --skip-themes --report-changed-only 2>/dev/null \
      | grep -E "^Success:|Replacements" || true
  fi
}

# ── Remote search-replace (with http/https variant + convergence pass) ─────────

remote_search_replace() {
  local from="$1" to="$2"
  local from_alt

  echo "  → Replacing: $from → $to"
  ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp search-replace '$from' '$to' \
    --all-tables --skip-plugins --skip-themes --allow-root 2>/dev/null \
    | grep -E '^Success:|Replacements'" || true

  if [[ "$from" == https://* ]]; then
    from_alt="${from/https:\/\//http:\/\/}"
  else
    from_alt="${from/http:\/\//https:\/\/}"
  fi
  if [[ "$from_alt" != "$from" ]]; then
    echo "  → Replacing: $from_alt → $to"
    ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp search-replace '$from_alt' '$to' \
      --all-tables --skip-plugins --skip-themes --allow-root 2>/dev/null \
      | grep -E '^Success:|Replacements'" || true
  fi

  echo "  → Convergence pass..."
  ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp search-replace '$from' '$to' \
    --all-tables --skip-plugins --skip-themes --report-changed-only --allow-root 2>/dev/null \
    | grep -E '^Success:|Replacements'" || true
  if [[ "$from_alt" != "$from" ]]; then
    ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp search-replace '$from_alt' '$to' \
      --all-tables --skip-plugins --skip-themes --report-changed-only --allow-root 2>/dev/null \
      | grep -E '^Success:|Replacements'" || true
  fi
}
