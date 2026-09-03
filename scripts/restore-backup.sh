#!/usr/bin/env bash
#
# Restore an encrypted backup, into somewhere that is not production.
#
#   scripts/restore-backup.sh dump-2026-09-03.sql.gz.gpg
#   scripts/restore-backup.sh dump-2026-09-03.sql.gz.gpg "postgresql://..."
#
# With no target it restores into the local Supabase stack, which is what you
# want the first time and most times after that: the point of running this is
# usually to find out whether the backup is real, not to recover from anything.
#
# BACKUP_PASSPHRASE must be set. It is the one thing not stored in this
# repository, deliberately, because the dumps are useless without it and
# keeping both in the same place would defeat encrypting them at all.

set -euo pipefail

FILE="${1:-}"
TARGET="${2:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [ -z "$FILE" ]; then
  echo "Which backup? e.g. scripts/restore-backup.sh dump-2026-09-03.sql.gz.gpg"
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "No such file: $FILE"
  echo "Backups live in the private backup repository named by BACKUP_REPO."
  exit 1
fi
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "BACKUP_PASSPHRASE is not set, so this cannot be decrypted."
  exit 1
fi

# Refusing production outright. Restoring a dump runs DROP against every table
# it recreates, and doing that to the live database by mistyping an argument is
# not a mistake worth leaving available.
if [[ "$TARGET" == *"supabase.co"* || "$TARGET" == *"pooler.supabase.com"* ]]; then
  echo "That target looks like the hosted project. Refusing."
  echo "Restore into a scratch project or the local stack, check it, then decide."
  exit 1
fi

echo "Restoring $FILE into $TARGET"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

gpg --batch --quiet --decrypt --passphrase "$BACKUP_PASSPHRASE" "$FILE" \
  | gunzip > "$TMP/dump.sql"

echo "decrypted $(stat -c%s "$TMP/dump.sql") bytes"

psql "$TARGET" -v ON_ERROR_STOP=0 -q -f "$TMP/dump.sql" > "$TMP/restore.log" 2>&1 || true

# Errors are expected and mostly harmless: a --clean dump drops objects that do
# not exist yet on a fresh database. What matters is whether the rows arrived.
ERRORS=$(grep -c "^ERROR" "$TMP/restore.log" || true)
echo "psql reported $ERRORS error line(s); see $TMP/restore.log if that looks high"

echo
echo "What came back:"
psql "$TARGET" -tAc "
  select 'profiles      ' || count(*) from public.profiles
  union all select 'sessions      ' || count(*) from public.sessions
  union all select 'invoices      ' || count(*) from public.invoices
  union all select 'earnings      ' || count(*) from public.earnings
  union all select 'admissions    ' || count(*) from public.admissions_plans;
"

echo
echo "If those counts look like the real database, the backup is good."
