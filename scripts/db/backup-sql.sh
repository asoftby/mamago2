#!/usr/bin/env bash
set -euo pipefail

# Configuration
CONTAINER_NAME="mamago2-db"
DB_USER="mamago"
DB_NAME="mamago2"
BACKUP_DIR="backups/mamago"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mamago_${TIMESTAMP}.sql"
MAX_BACKUPS=10

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo -e "${RED}Error: Container '${CONTAINER_NAME}' is not running${NC}"
  echo "Start it with: docker compose up -d"
  exit 1
fi

# Create SQL backup
echo "Creating SQL backup..."
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"

# Get file size
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  FILE_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
else
  # Linux
  FILE_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
fi

# Print success message
echo -e "${GREEN}✓ SQL backup created successfully${NC}"
echo "  Path: ${BACKUP_FILE}"
echo "  Size: ${FILE_SIZE}"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"

# Clean up old SQL backups (keep only last MAX_BACKUPS)
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "mamago_*.sql" -type f | wc -l | tr -d ' ')
if [ "${BACKUP_COUNT}" -gt "${MAX_BACKUPS}" ]; then
  echo ""
  echo "Cleaning up old SQL backups (keeping last ${MAX_BACKUPS})..."
  find "${BACKUP_DIR}" -name "mamago_*.sql" -type f | sort | head -n -${MAX_BACKUPS} | xargs rm -f
  echo -e "${YELLOW}✓ Removed $((BACKUP_COUNT - MAX_BACKUPS)) old SQL backup(s)${NC}"
fi
