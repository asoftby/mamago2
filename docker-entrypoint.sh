#!/bin/sh
set -e

# TEMPORARY: resolve failed branding migration state on dev DB.
# Remove after first successful deploy with migrations 20260615134948 and 20260615160000 applied.
npx prisma migrate resolve --rolled-back 20260615134948_add_branding_config 2>/dev/null || true

npx prisma migrate deploy

exec node server.js
