#!/usr/bin/env bash
# Shared helpers for scripts that run commands on the server. Source it, don't run it.
#
#   rq <string>   quote a value for the remote shell (single quotes, safe for spaces and quotes)
#   RWP           REMOTE_WP_PATH, already quoted, for use inside ssh command strings

rq() { local s=${1//\'/\'\\\'\'}; printf "'%s'" "$s"; }
RWP="$(rq "${REMOTE_WP_PATH:-}")"

# rsync to/from the server with a path that may hold spaces or quotes:
#   rsync "${RSYNC_REMOTE[@]}" … "$SSH_TARGET:$(rpath "$dir")/"
# rsync ≥ 3 sends the path untouched with -s; the 2.6.9 macOS ships passes it through
# the remote shell, so there it is escaped instead.
if rsync --help 2>&1 | grep -q -- '--protect-args'; then
  RSYNC_REMOTE=(-s)
  rpath() { printf '%s' "$1"; }
else
  RSYNC_REMOTE=()
  rpath() { printf '%q' "$1"; }
fi
