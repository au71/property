#!/usr/bin/env bash
#
# Back up the SQLite database and uploaded photos.
#
# `VACUUM INTO` is used rather than `cp` because cp is not atomic against a live
# writer: it can capture a torn page and produce a backup that restores to a
# corrupt database. VACUUM INTO takes a read lock and writes a consistent,
# already-compacted copy.
#
# It runs through the API's own better-sqlite3 rather than the sqlite3 CLI, so
# there is no extra package to install and the backup is written by exactly the
# same SQLite build that writes the database.
#
set -euo pipefail

DB="${DB:-/srv/property/data/property.db}"
UPLOADS="${UPLOADS:-/srv/property/data/uploads}"
DEST="${DEST:-/srv/property/backups}"
KEEP_HOURLY="${KEEP_HOURLY:-24}"
KEEP_DAILY="${KEEP_DAILY:-14}"

mkdir -p "$DEST/hourly" "$DEST/daily"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$DEST/hourly/property-$stamp.db"

API_DIR="${API_DIR:-/srv/property/api}"
node -e '
  const Database = require(process.argv[1] + "/node_modules/better-sqlite3");
  const db = new Database(process.argv[2], { readonly: true, fileMustExist: true });
  // VACUUM INTO refuses to overwrite, so a stale target is an error, not a
  // silent half-backup.
  db.prepare("VACUUM INTO ?").run(process.argv[3]);
  db.close();
' "$API_DIR" "$DB" "$target"
gzip -9 "$target"
echo "wrote $target.gz ($(du -h "$target.gz" | cut -f1))"

# One snapshot a day is promoted and kept for longer.
if [[ ! -f "$DEST/daily/property-$(date -u +%Y%m%d).db.gz" ]]; then
  cp "$target.gz" "$DEST/daily/property-$(date -u +%Y%m%d).db.gz"
fi

# Uploaded photos are immutable: a replacement gets a new filename, nothing is
# ever rewritten in place. So the mirror only ever needs new files adding, and
# `cp -aln` does that with hard links — no rsync, no extra disk, no duplication.
#
# Being hard links, this protects against an accidental delete but not against
# the disk failing. That is what the offsite sync below is for.
mkdir -p "$DEST/uploads-mirror"
cp -aln "$UPLOADS/." "$DEST/uploads-mirror/" 2>/dev/null || true
mirrored=$(find "$DEST/uploads-mirror" -type f | wc -l)
live=$(find "$UPLOADS" -type f | wc -l)
echo "photos: $live live, $mirrored mirrored"

prune() {
  local dir="$1" keep="$2"
  find "$dir" -maxdepth 1 -type f -name '*.db.gz' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | tail -n "+$((keep + 1))" | cut -d' ' -f2- \
    | while read -r old; do rm -f "$old"; done
}
prune "$DEST/hourly" "$KEEP_HOURLY"
prune "$DEST/daily" "$KEEP_DAILY"

echo "backups: $(ls -1 "$DEST/hourly" | wc -l) hourly, $(ls -1 "$DEST/daily" | wc -l) daily"

# --- Offsite ----------------------------------------------------------------
# A backup on the same disk as the database is not a backup. Uncomment one:
#
#   rclone sync "$DEST/daily" remote:property-backups/daily
#   rclone sync "$UPLOADS" remote:property-backups/uploads
#   aws s3 sync "$DEST/daily" s3://your-bucket/property/daily/
