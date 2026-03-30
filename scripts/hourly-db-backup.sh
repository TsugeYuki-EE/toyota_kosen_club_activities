#!/bin/sh
set -eu

export TZ="${TZ:-Asia/Tokyo}"

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-club}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "POSTGRES_PASSWORD is required" >&2
  exit 1
fi

HANDBALL_DIR="$BACKUP_ROOT/handball"
TABLE_TENNIS_DIR="$BACKUP_ROOT/table-tennis"
RETENTION_MINUTES=4320
MAX_FILES=72

mkdir -p "$HANDBALL_DIR" "$TABLE_TENNIS_DIR"

echo "[$(date -Iseconds)] waiting for postgres..."
until PGPASSWORD="$POSTGRES_PASSWORD" pg_isready \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$POSTGRES_USER" \
  --dbname postgres >/dev/null 2>&1; do
  sleep 2
done
echo "[$(date -Iseconds)] postgres is ready"

backup_one() {
  label="$1"
  db_name="$2"
  output_dir="$3"

  timestamp="$(date +"%Y%m%d-%H0000")"
  output_file="$output_dir/${label}-${timestamp}.dump"

  echo "[$(date -Iseconds)] backup start: $db_name -> $output_file"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    --host "$PGHOST" \
    --port "$PGPORT" \
    --username "$POSTGRES_USER" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --dbname "$db_name" \
    --file "$output_file"

  # 3日より古いバックアップを削除
  find "$output_dir" -type f -name "$label-*.dump" -mmin +"$RETENTION_MINUTES" -delete

  # 念のため、最新72本だけ残す（1時間1本×3日）
  file_list="$(ls -1t "$output_dir"/$label-*.dump 2>/dev/null || true)"
  if [ -n "$file_list" ]; then
    echo "$file_list" | awk 'NR>72 {print}' | xargs -r rm -f
  fi

  echo "[$(date -Iseconds)] backup done: $db_name"
}

while true; do
  backup_one "handball" "handball_notes" "$HANDBALL_DIR"
  backup_one "table-tennis" "table_tennis_notes" "$TABLE_TENNIS_DIR"
  sleep 3600
done
