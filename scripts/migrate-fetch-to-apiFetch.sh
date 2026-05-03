#!/bin/bash

# Script to find all fetch calls that need credentials: "include"
# Usage: ./scripts/migrate-fetch-to-apiFetch.sh

echo "=== Finding fetch calls without credentials ==="
echo ""

# Find all fetch calls in components
grep -r "fetch(" src/components --include="*.tsx" | \
  grep -v "apiFetch" | \
  grep -v "credentials" | \
  grep -v "node_modules" | \
  cut -d: -f1 | \
  sort -u | \
  while read file; do
    echo "📄 $file"
  done

echo ""
echo "=== Summary ==="
count=$(grep -r "fetch(" src/components --include="*.tsx" | \
  grep -v "apiFetch" | \
  grep -v "credentials" | \
  grep -v "node_modules" | \
  cut -d: -f1 | \
  sort -u | \
  wc -l)

echo "Files to update: $count"
echo ""
echo "=== Migration steps ==="
echo "1. Add import: import { apiFetch } from '@/lib/api/fetch';"
echo "2. Replace: fetch(...) → apiFetch(...)"
echo "3. Remove: headers: { 'Content-Type': 'application/json' } (apiFetch adds it)"
echo "4. Update: body: JSON.stringify(...) → body: JSON.stringify(...) (same)"
