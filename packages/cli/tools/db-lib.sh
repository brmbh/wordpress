#!/usr/bin/env bash
# Shared library for DB sync scripts. Source this file — do not execute directly.
#
# Requires env vars (set by `brmbh db …` from brmbh.json, or by sourcing a legacy tools/env/*.env):
#   SSH_TARGET, REMOTE_WP_PATH, REMOTE_URL, LOCAL_URL,
#   LOCAL_THEME, REMOTE_THEME, LOCAL_WP_PATH, LOCAL_WP_CLI
#   CANONICAL_ENV — "local" (push allowed) | "remote" (push blocked, remote is truth)
#
# Usage in a script:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/db-lib.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/remote.sh"
# The CLI passes both. Guessing from SCRIPT_DIR only works for a theme-local tools/
# copy; inside node_modules/@brmbh/cli/tools it would land in the wrong folder.
THEME_DIR="${BRMBH_THEME_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"
LOCAL_WP_CLI="${LOCAL_WP_CLI:-wp}"

# ── Validate required env vars ─────────────────────────────────────────────────

db_check_env() {
  for var in SSH_TARGET REMOTE_WP_PATH REMOTE_URL LOCAL_THEME REMOTE_THEME; do
    if [[ -z "${!var:-}" ]]; then
      echo "Error: $var is not set." >&2
      echo "Run through the CLI (npx brmbh db pull <env>) with the environment in brmbh.json." >&2
      exit 1
    fi
  done

  # No guessing: every URL in the database is rewritten to this value.
  if [[ -z "${LOCAL_URL:-}" ]]; then
    echo "Error: the local site URL is not set." >&2
    echo "Add it to brmbh.local.json: {\"local\": {\"url\": \"https://my-site.local\"}}" >&2
    exit 1
  fi

  CANONICAL_ENV="${CANONICAL_ENV:-remote}"
}

# Guard: block db-push when remote is the canonical source of truth.
db_check_canonical_for_push() {
  if [[ "${CANONICAL_ENV:-remote}" == "remote" ]]; then
    echo "" >&2
    echo "❌  db-push blocked — CANONICAL_ENV=remote" >&2
    echo "   The remote ($REMOTE_URL) is the source of truth." >&2
    echo "   To push up, set \"canonical\": \"local\" on this environment in brmbh.json." >&2
    echo "" >&2
    exit 1
  fi
}

# ── Backups: the target of every import is saved first (ADR 009) ─────────────

BACKUP_STAMP="$(date +%Y%m%d-%H%M%S)"

# Local DB → <theme>/.brmbh/backups/local-<env>-<stamp>.sql.gz (gitignored)
db_backup_local() {
  local dir="$THEME_DIR/.brmbh/backups"
  mkdir -p "$dir"
  local file="$dir/local-before-${BRMBH_ENV:-pull}-$BACKUP_STAMP.sql"
  echo "💾 Backing up the local DB first → ${file}.gz"
  $LOCAL_WP_CLI db export "$file" --path="$LOCAL_WP_PATH" --quiet
  gzip -f "$file"
}

# Remote DB → ~/.brmbh-backups/<env>-<stamp>.sql.gz on the server (outside the web root)
db_backup_remote() {
  local file="~/.brmbh-backups/${BRMBH_ENV:-remote}-before-push-$BACKUP_STAMP.sql.gz"
  echo "💾 Backing up the remote DB first → $SSH_TARGET:$file"
  ssh "$SSH_TARGET" "mkdir -p ~/.brmbh-backups && cd $RWP && wp db export - --allow-root | gzip > $file && test -s $file"
}

# ── Plugins: local files at exactly the server's versions ───────────────────
# After a pull the local DB is the server's, so the plugin files should be too.
# Never `plugin update --all`: that installs the newest release, not the server's.

match_plugin_versions() {
  local remote_list local_list name version current changed=0
  if ! remote_list="$(ssh "$SSH_TARGET" "cd $RWP && wp plugin list --fields=name,version --format=csv --allow-root --skip-plugins --skip-themes 2>/dev/null")"; then
    echo "  ! Could not read the server's plugin list; local plugins left as they are."
    return 0
  fi
  local_list="$($LOCAL_WP_CLI plugin list --fields=name,version --format=csv --path="$LOCAL_WP_PATH" --skip-plugins --skip-themes 2>/dev/null || true)"
  while IFS=, read -r name version; do
    [[ -z "$name" || "$name" == "name" ]] && continue
    current="$(printf '%s\n' "$local_list" | awk -F, -v n="$name" '$1==n {print $2}')"
    [[ "$current" == "$version" ]] && continue
    changed=1
    if $LOCAL_WP_CLI plugin install "$name" --version="$version" --force --path="$LOCAL_WP_PATH" --skip-plugins --skip-themes >/dev/null 2>&1; then
      echo "  ✓ $name ${current:-not installed} → $version"
    else
      echo "  ! $name: the server runs $version, local has ${current:-none}. Not on wordpress.org (premium?): copy wp-content/plugins/$name from the server."
    fi
  done <<< "$remote_list"
  [[ $changed == 0 ]] && echo "  ✓ All plugins already at the server's versions"
  return 0
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
  if ssh "$SSH_TARGET" "cd $RWP && wp db check --allow-root --quiet" 2>/dev/null; then
    local remote_siteurl
    remote_siteurl="$(ssh "$SSH_TARGET" "cd $RWP && wp option get siteurl --allow-root --quiet" 2>/dev/null || true)"
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
  ssh "$SSH_TARGET" "cd $RWP && wp search-replace '$from' '$to' \
    --all-tables --skip-plugins --skip-themes --allow-root 2>/dev/null \
    | grep -E '^Success:|Replacements'" || true

  if [[ "$from" == https://* ]]; then
    from_alt="${from/https:\/\//http:\/\/}"
  else
    from_alt="${from/http:\/\//https:\/\/}"
  fi
  if [[ "$from_alt" != "$from" ]]; then
    echo "  → Replacing: $from_alt → $to"
    ssh "$SSH_TARGET" "cd $RWP && wp search-replace '$from_alt' '$to' \
      --all-tables --skip-plugins --skip-themes --allow-root 2>/dev/null \
      | grep -E '^Success:|Replacements'" || true
  fi

  echo "  → Convergence pass..."
  ssh "$SSH_TARGET" "cd $RWP && wp search-replace '$from' '$to' \
    --all-tables --skip-plugins --skip-themes --report-changed-only --allow-root 2>/dev/null \
    | grep -E '^Success:|Replacements'" || true
  if [[ "$from_alt" != "$from" ]]; then
    ssh "$SSH_TARGET" "cd $RWP && wp search-replace '$from_alt' '$to' \
      --all-tables --skip-plugins --skip-themes --report-changed-only --allow-root 2>/dev/null \
      | grep -E '^Success:|Replacements'" || true
  fi
}
