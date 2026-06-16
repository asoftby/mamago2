#!/bin/sh
set -e

# Ensures required system/reference data exists (Country, Region, City "minsk",
# districts, metro stations, place/event categories, signals, filters, discovery tags).
# prisma/seed.ts is idempotent and creates SYSTEM data only — no mock/demo content.
# Gate behind an env flag so production never runs this implicitly.
if [ "$MAMAGO_RUN_SYSTEM_SEED_ON_START" = "true" ]; then
  echo "Ensuring system reference data..."
  pnpm db:seed:system
fi

echo "Starting Next.js server..."
exec node server.js
