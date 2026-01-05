# Database Administration Guide

SQLite database with automatic migrations. Deployed on Railway with persistent volume.

## How Migrations Work

On startup, the server:
1. Creates `schema_migrations` table if missing
2. Checks which migrations have been applied
3. Runs only new migrations in order
4. Records each successful migration

Migration files live in `src/server/db/migrations/` with format `NNN_name.sql`.

## Railway Setup

### Volume Configuration

Ensure Railway has a persistent volume mounted at `/data`:

```
DB_PATH=/data/horseboard.db
```

Without a volume, data is lost on each deploy.

### Verify Volume Persistence

```bash
railway run -- sqlite3 /data/horseboard.db "SELECT * FROM schema_migrations;"
```

Expected output shows applied migrations:
```
001|2025-01-15 10:30:00
002|2025-01-15 10:30:00
```

## Backups

### Manual Backup

```bash
# Download database from Railway
railway run -- cat /data/horseboard.db > backup-$(date +%Y%m%d).db

# Verify backup
sqlite3 backup-*.db "SELECT COUNT(*) FROM boards;"
```

### Restore from Backup

```bash
# Upload to Railway (stops service first)
railway run -- sh -c 'cat > /data/horseboard.db' < backup.db
```

## Adding New Migrations

1. Create `src/server/db/migrations/003_description.sql`
2. Use next sequential number
3. Deploy - migration runs automatically

Example migration:
```sql
-- Add email column to boards
ALTER TABLE boards ADD COLUMN owner_email TEXT;
```

Migrations should be forward-only. No rollback support.

## Troubleshooting

### Check Migration Status

```bash
railway run -- sqlite3 /data/horseboard.db "SELECT * FROM schema_migrations ORDER BY version;"
```

### Migration Failed Midway

If a migration fails partway through, the database may be in an inconsistent state. The failed migration won't be recorded, so it will retry on next startup.

To fix manually:
1. Backup the database
2. Connect and inspect: `railway run -- sqlite3 /data/horseboard.db`
3. Complete or rollback the partial changes manually
4. Either let migration retry, or insert record: `INSERT INTO schema_migrations (version) VALUES ('003');`

### Database Corruption

SQLite with WAL mode is resilient, but if corruption occurs:

```bash
# Check integrity
railway run -- sqlite3 /data/horseboard.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
```

### Reset for Fresh Start

Only for dev/staging - destroys all data:

```bash
railway run -- rm /data/horseboard.db*
# Redeploy - fresh database with all migrations
```
