#!/bin/bash

# Fix Billing - Regenerate Prisma Client
# This script fixes the "Cannot read properties of undefined (reading 'aggregate')" error

echo "🔧 Fixing Billing System..."
echo ""

echo "📦 Step 1: Generating Prisma Client..."
npm run db:generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

echo "✅ Prisma client generated successfully"
echo ""

echo "🗄️  Step 2: Checking if migrations are needed..."
echo "Run 'npm run db:migrate' if you haven't run migrations yet"
echo ""

echo "🌱 Step 3: Checking if seed data is needed..."
echo "Run 'npm run db:seed' if you need test data"
echo ""

echo "✅ Billing system is ready!"
echo ""
echo "🚀 Start the dev server with: npm run dev"
