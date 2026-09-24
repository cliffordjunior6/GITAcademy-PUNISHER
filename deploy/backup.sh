#!/usr/bin/env bash
# Real backup script for GITAcademy's database and uploaded files.
# Run manually, or on a schedule via cron, e.g. daily at 2am:
#   0 2 * * * /var/www/gitacademy/deploy/backup.sh >> /var/log/gitacademy-backup.log 2>&1
#
# Keeps the last 14 backups and deletes older ones automatically.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
KEEP=14

mkdir -p "$BACKUP_DIR"

DB_PATH="$APP_DIR/api/database.sqlite"
if [ -f "$DB_PATH" ]; then
  # sqlite3 .backup is the correct, safe way to copy a live SQLite DB
  # (unlike `cp`, it won't produce a corrupt copy if a write is mid-flight).
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/db_$TIMESTAMP.sqlite'"
  else
    cp "$DB_PATH" "$BACKUP_DIR/db_$TIMESTAMP.sqlite"
  fi
  echo "[$(date)] Database backed up to db_$TIMESTAMP.sqlite"
else
  echo "[$(date)] WARNING: no database found at $DB_PATH — skipping DB backup"
fi

UPLOADS_DIR="$APP_DIR/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C "$APP_DIR" uploads
  echo "[$(date)] Uploads backed up to uploads_$TIMESTAMP.tar.gz"
fi

# Prune old backups, keeping only the most recent $KEEP of each type
cd "$BACKUP_DIR"
ls -1t db_*.sqlite 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t uploads_*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

echo "[$(date)] Backup complete. $(ls "$BACKUP_DIR" | wc -l) file(s) retained."
