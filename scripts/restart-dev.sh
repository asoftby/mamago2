#!/bin/bash

echo "🔄 Restarting Next.js dev server with clean cache..."
echo ""

# Kill any running dev servers
echo "1. Stopping any running dev servers..."
pkill -f "next dev" || true
sleep 1

# Clear Next.js cache
echo "2. Clearing .next cache..."
rm -rf .next

# Regenerate Prisma client
echo "3. Regenerating Prisma client..."
npx prisma generate

echo ""
echo "✅ Ready to restart!"
echo ""
echo "Now run: pnpm dev"
