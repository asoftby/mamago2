#!/usr/bin/env bash
set -euo pipefail

# Configuration
CONTAINER_NAME="mamago2-db"
DB_USER="mamago"
DB_NAME="mamago2"
BACKUP_DIR="backups/mamago"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file argument is provided
if [ $# -eq 0 ]; then
  echo -e "${RED}Error: No backup file specified${NC}"
  echo ""
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Example:"
  echo "  $0 backups/mamago/mamago_20240309_120000.dump"
  echo "  $0 backups/mamago/mamago_20240309_120000.sql"
  echo ""
  echo "To see available backups, run:"
  echo "  pnpm db:backups"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
  echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
  exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo -e "${RED}Error: Container '${CONTAINER_NAME}' is not running${NC}"
  echo "Start it with: docker compose up -d"
  exit 1
fi

# Determine file type
FILE_EXT="${BACKUP_FILE##*.}"
if [ "${FILE_EXT}" != "dump" ] && [ "${FILE_EXT}" != "sql" ]; then
  echo -e "${RED}Error: Unsupported file type: .${FILE_EXT}${NC}"
  echo "Supported types: .dump, .sql"
  exit 1
fi

# Create emergency backup before restore
echo -e "${YELLOW}Creating emergency backup before restore...${NC}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
EMERGENCY_BACKUP="${BACKUP_DIR}/pre_restore_${TIMESTAMP}.dump"
mkdir -p "${BACKUP_DIR}"
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -Fc "${DB_NAME}" > "${EMERGENCY_BACKUP}"
echo -e "${GREEN}✓ Emergency backup saved: ${EMERGENCY_BACKUP}${NC}"
echo ""

# Confirm restore
echo -e "${YELLOW}⚠️  WARNING: This will completely replace the current database!${NC}"
echo "  Database: ${DB_NAME}"
echo "  Restore from: ${BACKUP_FILE}"
echo "  Emergency backup: ${EMERGENCY_BACKUP}"
echo ""
read -p "Continue with restore? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Restore cancelled"
  exit 0
fi

# Perform restore based on file type
echo "Restoring database..."

if [ "${FILE_EXT}" = "dump" ]; then
  # Restore from custom format dump
  echo "Using pg_restore for .dump file..."
  
  # Copy dump file to container
  TEMP_FILE="/tmp/restore_${TIMESTAMP}.dump"
  docker cp "${BACKUP_FILE}" "${CONTAINER_NAME}:${TEMP_FILE}"
  
  # Drop and recreate schema
  docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1
  
  # Restore using pg_restore
  docker exec "${CONTAINER_NAME}" pg_restore \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${TEMP_FILE}" 2>&1 | grep -v "^WARNING:" | grep -v "^ERROR:" | head -20 || true
  
  # Clean up temp file
  docker exec "${CONTAINER_NAME}" rm -f "${TEMP_FILE}"
  
elif [ "${FILE_EXT}" = "sql" ]; then
  # Restore from SQL file
  echo "Using psql for .sql file..."
  
  # Drop and recreate schema
  docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1
  
  # Restore using psql
  cat "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1
fi

# Print success message
echo ""
echo -e "${GREEN}✓ Database restored successfully${NC}"
echo "  From: ${BACKUP_FILE}"
echo "  To: ${DB_NAME}"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${YELLOW}Note: Run 'npx prisma generate' if you see Prisma Client errors${NC}"
