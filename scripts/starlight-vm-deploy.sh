#!/usr/bin/env bash
set -euo pipefail

WEB_ROOT="${1:-}"
ARCHIVE_PATH="${2:-}"
BACKUP_ROOT="${3:-}"
RELEASE_ID="${4:-manual-$(date +%Y%m%d%H%M%S)}"

fail() {
  echo "Starlight deploy failed: $*" >&2
  exit 1
}

[[ -n "$WEB_ROOT" ]] || fail "missing web root"
[[ -n "$ARCHIVE_PATH" ]] || fail "missing archive path"
[[ "$WEB_ROOT" == /* ]] || fail "web root must be an absolute path"
[[ "$ARCHIVE_PATH" == /tmp/loafers-dist-* ]] || fail "archive must live in /tmp and use the loafers-dist prefix"

case "$WEB_ROOT" in
  "/"|"/var"|"/var/www"|"/home"|"/usr"|"/usr/share"|"/etc"|"/tmp")
    fail "refusing to deploy into unsafe root path: $WEB_ROOT"
    ;;
esac

[[ -f "$ARCHIVE_PATH" ]] || fail "archive not found: $ARCHIVE_PATH"

if [[ -z "$BACKUP_ROOT" ]]; then
  BACKUP_ROOT="${WEB_ROOT%/}-backups"
fi

TEMP_DIR="/tmp/loafers-release-${RELEASE_ID}"
BACKUP_FILE="${BACKUP_ROOT%/}/pre-loafers-${RELEASE_ID}-$(date +%Y%m%d%H%M%S).tgz"

rm -rf -- "$TEMP_DIR"
mkdir -p "$TEMP_DIR" "$WEB_ROOT" "$BACKUP_ROOT"
tar -xzf "$ARCHIVE_PATH" -C "$TEMP_DIR"

if [[ -n "$(find "$WEB_ROOT" -mindepth 1 -maxdepth 1 ! -name ".well-known" -print -quit)" ]]; then
  tar --exclude="./.well-known" -czf "$BACKUP_FILE" -C "$WEB_ROOT" .
  echo "Backed up previous site to $BACKUP_FILE"
else
  echo "No previous site files found to back up."
fi

find "$WEB_ROOT" -mindepth 1 -maxdepth 1 ! -name ".well-known" -exec rm -rf -- {} +
cp -a "$TEMP_DIR"/. "$WEB_ROOT"/
printf "%s\n" "$RELEASE_ID" > "$WEB_ROOT/.loafers-release"

rm -rf -- "$TEMP_DIR" "$ARCHIVE_PATH"
echo "Loafers deployed to $WEB_ROOT as release $RELEASE_ID"
