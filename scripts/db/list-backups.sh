#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="backups/mamago"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup directory exists
if [ ! -d "${BACKUP_DIR}" ]; then
  echo "No backups directory found at: ${BACKUP_DIR}"
  exit 0
fi

# Count backups
DUMP_COUNT=$(find "${BACKUP_DIR}" -name "mamago_*.dump" -type f 2>/dev/null | wc -l | tr -d ' ')
SQL_COUNT=$(find "${BACKUP_DIR}" -name "mamago_*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_COUNT=$((DUMP_COUNT + SQL_COUNT))

if [ "${TOTAL_COUNT}" -eq 0 ]; then
  echo "No backups found in: ${BACKUP_DIR}"
  exit 0
fi

echo -e "${GREEN}Database Backups${NC} (${TOTAL_COUNT} total)"
echo "Location: ${BACKUP_DIR}"
echo ""

# List .dump files
if [ "${DUMP_COUNT}" -gt 0 ]; then
  echo -e "${YELLOW}Custom Format Backups (.dump):${NC}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    find "${BACKUP_DIR}" -name "mamago_*.dump" -type f -exec ls -lh {} \; | \
      awk '{print $9, "  ", $5, "  ", $6, $7, $8}' | \
      sed 's|.*/||' | \
      sort -r
  else
    # Linux
    find "${BACKUP_DIR}" -name "mamago_*.dump" -type f -exec ls -lh {} \; | \
      awk '{print $9, "  ", $5, "  ", $6, $7, $8}' | \
      sed 's|.*/||' | \
      sort -r
  fi
  echo ""
fi

# List .sql files
if [ "${SQL_COUNT}" -gt 0 ]; then
  echo -e "${YELLOW}SQL Backups (.sql):${NC}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    find "${BACKUP_DIR}" -name "mamago_*.sql" -type f -exec ls -lh {} \; | \
      awk '{print $9, "  ", $5, "  ", $6, $7, $8}' | \
      sed 's|.*/||' | \
      sort -r
  else
    # Linux
    find "${BACKUP_DIR}" -name "mamago_*.sql" -type f -exec ls -lh {} \; | \
      awk '{print $9, "  ", $5, "  ", $6, $7, $8}' | \
      sed 's|.*/||' | \
      sort -r
  fi
fi
