#!/usr/bin/env bash
# Version Drift Check: compares WordPress core, plugins, PHP, and theme versions
# between local and production environments.
#
# Usage:
#   source tools/env/staging.env && ./tools/version-check.sh
#   source tools/env/production.env && ./tools/version-check.sh
#
# Requires: WP-CLI locally and on server, SSH access (same setup as db-pull/push)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WP_PATH="${LOCAL_WP_PATH:-$(cd "$THEME_DIR/../../.." && pwd)}"

# Local PHP binary for the version compare. On macOS + Local by Flywheel this
# auto-detects Local's bundled PHP; otherwise it falls back to system `php`.
LOCAL_PHP_BIN=$(ls -d "$HOME/Library/Application Support/Local/lightning-services/php-"*/bin/darwin-arm64/bin/php 2>/dev/null | sort -V | tail -1)
LOCAL_PHP_BIN="${LOCAL_PHP_BIN:-php}"

# Respects LOCAL_WP_CLI (set to "localwp" for Local by Flywheel; defaults to "wp").
WP_LOCAL=("${LOCAL_WP_CLI:-wp}" --path="$LOCAL_WP_PATH" --skip-plugins --skip-themes)

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✅  $*${RESET}"; }
warn() { echo -e "  ${YELLOW}⚠️   $*${RESET}"; }
fail() { echo -e "  ${RED}❌  $*${RESET}"; }
info() { echo -e "  ${CYAN}$*${RESET}"; }

DRIFT_COUNT=0
drift() { DRIFT_COUNT=$((DRIFT_COUNT + 1)); fail "$*"; }

for var in SSH_TARGET REMOTE_WP_PATH REMOTE_URL LOCAL_URL LOCAL_THEME REMOTE_THEME; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set."
    echo "Run: source tools/env/staging.env && ./tools/version-check.sh"
    exit 1
  fi
done

echo ""
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Version Drift Check — Local vs Remote       ${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Local:      ${CYAN}$LOCAL_URL${RESET}  →  $LOCAL_WP_PATH"
echo -e "  Remote:     ${CYAN}$REMOTE_URL${RESET}  →  $SSH_TARGET:$REMOTE_WP_PATH"
echo ""

# ── 1. PHP Version ─────────────────────────────────────────────────────────────
echo -e "${BOLD}[1/4] PHP Version${RESET}"

LOCAL_PHP=$("$LOCAL_PHP_BIN" -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION.'.'.PHP_RELEASE_VERSION;" 2>/dev/null || echo "unknown")
REMOTE_PHP=$(ssh "$SSH_TARGET" 'php -r "echo PHP_MAJOR_VERSION.\".\".PHP_MINOR_VERSION.\".\".PHP_RELEASE_VERSION;"' 2>/dev/null || echo "unknown")

info "Local:  PHP $LOCAL_PHP"
info "Remote: PHP $REMOTE_PHP"

LOCAL_PHP_MINOR=$(echo "$LOCAL_PHP" | cut -d. -f1-2)
REMOTE_PHP_MINOR=$(echo "$REMOTE_PHP" | cut -d. -f1-2)

if [[ "$LOCAL_PHP" == "unknown" || "$REMOTE_PHP" == "unknown" ]]; then
  warn "Could not compare PHP versions"
elif [[ "$LOCAL_PHP_MINOR" == "$REMOTE_PHP_MINOR" ]]; then
  ok "PHP minor versions match ($LOCAL_PHP_MINOR.x)"
else
  drift "PHP minor version mismatch — Local: $LOCAL_PHP / Remote: $REMOTE_PHP"
  echo -e "    ${YELLOW}Fix: align PHP versions in your hosting/Local by Flywheel settings.${RESET}"
fi
echo ""

# ── 2. WordPress Core Version ──────────────────────────────────────────────────
echo -e "${BOLD}[2/4] WordPress Core Version${RESET}"

LOCAL_WP=$("${WP_LOCAL[@]}" core version 2>/dev/null | grep -v Deprecated | grep -v "^$" | head -1 || echo "unknown")
REMOTE_WP=$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp core version --allow-root --skip-plugins --skip-themes 2>/dev/null" | head -1 || echo "unknown")

info "Local:  WP $LOCAL_WP"
info "Remote: WP $REMOTE_WP"

if [[ "$LOCAL_WP" == "unknown" || "$REMOTE_WP" == "unknown" ]]; then
  warn "Could not compare WP versions"
elif [[ "$LOCAL_WP" == "$REMOTE_WP" ]]; then
  ok "WordPress versions match ($LOCAL_WP)"
else
  drift "WordPress version mismatch — Local: $LOCAL_WP / Remote: $REMOTE_WP"
  echo -e "    ${YELLOW}Fix: update both environments:${RESET}"
  echo -e "    ${CYAN}wp core update --path=\"$LOCAL_WP_PATH\"${RESET}"
  echo -e "    ${CYAN}ssh $SSH_TARGET \"cd $REMOTE_WP_PATH && wp core update --allow-root\"${RESET}"
fi
echo ""

# ── 3. Theme Version ───────────────────────────────────────────────────────────
echo -e "${BOLD}[3/4] Theme Version${RESET}"

LOCAL_THEME_VER=$("${WP_LOCAL[@]}" theme get "$LOCAL_THEME" --field=version 2>/dev/null | grep -v Deprecated | grep -v "^$" | head -1 || echo "unknown")
REMOTE_THEME_VER=$(ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp theme get $REMOTE_THEME --field=version --allow-root --skip-plugins --skip-themes 2>/dev/null" | head -1 || echo "unknown")

info "Local:  $LOCAL_THEME @ $LOCAL_THEME_VER"
info "Remote: $REMOTE_THEME @ $REMOTE_THEME_VER"

if [[ "$LOCAL_THEME_VER" == "unknown" || "$REMOTE_THEME_VER" == "unknown" ]]; then
  warn "Could not compare theme versions"
elif [[ "$LOCAL_THEME_VER" == "$REMOTE_THEME_VER" ]]; then
  ok "Theme versions match ($LOCAL_THEME_VER)"
else
  drift "Theme version mismatch — Local: $LOCAL_THEME_VER / Remote: $REMOTE_THEME_VER"
  echo -e "    ${YELLOW}Fix: deploy the theme — source an env file then ./tools/deploy.sh${RESET}"
fi
echo ""

# ── 4. Plugin Versions ─────────────────────────────────────────────────────────
echo -e "${BOLD}[4/4] Plugin Versions${RESET}"

TMP_LOCAL=$(mktemp /tmp/vc-local-XXXXXX.csv)
TMP_PROD=$(mktemp /tmp/vc-prod-XXXXXX.csv)

"${WP_LOCAL[@]}" plugin list --status=active --fields=name,version --format=csv 2>/dev/null \
  | grep -v Deprecated | grep -v "^name," | grep -v "^$" | sort > "$TMP_LOCAL"

ssh "$SSH_TARGET" "cd $REMOTE_WP_PATH && wp plugin list --status=active --fields=name,version --format=csv --allow-root --skip-plugins --skip-themes 2>/dev/null" \
  | grep -v "^name," | grep -v "^$" | sort > "$TMP_PROD"

MISMATCHES=$(join -t',' "$TMP_LOCAL" "$TMP_PROD" | awk -F',' '$2 != $3 { printf "%s  (Local: %s  →  Prod: %s)\n", $1, $2, $3 }')
ONLY_LOCAL=$(comm -23 <(awk -F',' '{print $1}' "$TMP_LOCAL") <(awk -F',' '{print $1}' "$TMP_PROD") | while read -r name; do
  ver=$(grep "^$name," "$TMP_LOCAL" | cut -d',' -f2)
  echo "$name @ $ver"
done)
ONLY_PROD=$(comm -13 <(awk -F',' '{print $1}' "$TMP_LOCAL") <(awk -F',' '{print $1}' "$TMP_PROD") | while read -r name; do
  ver=$(grep "^$name," "$TMP_PROD" | cut -d',' -f2)
  echo "$name @ $ver"
done)

rm -f "$TMP_LOCAL" "$TMP_PROD"

if [[ -z "$MISMATCHES" && -z "$ONLY_LOCAL" && -z "$ONLY_PROD" ]]; then
  ok "All active plugins match in name and version"
else
  if [[ -n "$MISMATCHES" ]]; then
    MISMATCH_COUNT=$(echo "$MISMATCHES" | grep -c .)
    DRIFT_COUNT=$((DRIFT_COUNT + MISMATCH_COUNT))
    echo -e "  ${RED}Version mismatches:${RESET}"
    while IFS= read -r line; do echo -e "    ${RED}❌  $line${RESET}"; done <<< "$MISMATCHES"
    echo -e "    ${YELLOW}Fix: update plugins in both environments to the same version.${RESET}"
    echo ""
  fi
  if [[ -n "$ONLY_LOCAL" ]]; then
    echo -e "  ${YELLOW}Active locally, missing/inactive on prod:${RESET}"
    while IFS= read -r line; do warn "$line"; done <<< "$ONLY_LOCAL"
    echo ""
  fi
  if [[ -n "$ONLY_PROD" ]]; then
    echo -e "  ${YELLOW}Active on prod, missing/inactive locally:${RESET}"
    while IFS= read -r line; do warn "$line"; done <<< "$ONLY_PROD"
    echo ""
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
if [[ "$DRIFT_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✅  No version drift detected. Environments are in sync.${RESET}"
else
  echo -e "${RED}${BOLD}  ❌  $DRIFT_COUNT drift(s) found. Review the items above.${RESET}"
fi
echo -e "${BOLD}══════════════════════════════════════════════${RESET}"
echo ""
