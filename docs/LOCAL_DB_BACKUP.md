# Local DB Backup

## Manual backup

```bash
pnpm db:backup
```

## Safe reset

```bash
pnpm db:reset:safe
```

## Safe migration

```bash
pnpm db:migrate:safe
```

## Enable daily backup via launchd

```bash
mkdir -p ~/Library/LaunchAgents
cp scripts/com.mamago.local-db-backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.mamago.local-db-backup.plist
```

## Verify the job is loaded

```bash
launchctl list | grep mamago
```

## Run the backup job manually through launchd

```bash
launchctl start com.mamago.local-db-backup
```

## Disable the job

```bash
launchctl unload ~/Library/LaunchAgents/com.mamago.local-db-backup.plist
```

## Backup location

```text
backups/db/
```

## Restore from a backup

```bash
gunzip -c backups/db/<file>.sql.gz | docker exec -i <postgres_container> psql -U <user> -d <db>
```
