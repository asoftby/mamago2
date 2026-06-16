#!/bin/sh
set -e

# TEMPORARY: unconditional run to verify system seed fixes /minsk 404s after
# a dev DB reset. Revert to the MAMAGO_RUN_SYSTEM_SEED_ON_START=true gate
# once confirmed on dev.
# prisma/seed.ts is idempotent and creates SYSTEM data only — no mock/demo content.
echo "Ensuring system reference data..."
pnpm db:seed:system

echo "Starting Next.js server..."
exec node server.js
