#!/bin/bash

# Verification script for Business Billing API Security
# This script checks that business billing endpoints are properly secured

echo "🔒 Verifying Business Billing API Security..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Check 1: No POST/PUT/DELETE endpoints (read-only)
echo "📋 Check 1: Read-only endpoints (no mutations)"
if grep -r "export async function POST\|export async function PUT\|export async function PATCH\|export async function DELETE" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: Found mutation endpoints in business billing${NC}"
  grep -r "export async function POST\|export async function PUT\|export async function PATCH\|export async function DELETE" src/app/api/business/billing --include="*.ts"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: Only GET endpoints found (read-only)${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 2: No direct balance mutations
echo "📋 Check 2: No direct balance mutations"
if grep -r "prisma\.billingAccount\.update\|prisma\.billingTransaction\.create" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: Found direct Prisma mutations in business billing${NC}"
  grep -r "prisma\.billingAccount\.update\|prisma\.billingTransaction\.create" src/app/api/business/billing --include="*.ts"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: No direct balance mutations found${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 3: Uses ownerUserId for business lookup (not businessId parameter)
echo "📋 Check 3: Uses ownerUserId for business lookup"
if grep -r "ownerUserId: user\.id" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS: Uses ownerUserId for secure business lookup${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: Does not use ownerUserId for business lookup${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Check 4: No businessId in query parameters (prevents cross-business access)
echo "📋 Check 4: No businessId in query parameters"
if grep -r "searchParams\.get.*businessId" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: Found businessId in query parameters (security risk)${NC}"
  grep -r "searchParams\.get.*businessId" src/app/api/business/billing --include="*.ts"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: No businessId in query parameters${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 5: Filters out admin metadata
echo "📋 Check 5: Filters out admin metadata"
if grep -r "adminId\|adminEmail" src/app/api/business/billing --include="*.ts" | grep -v "// " | grep -v "NOT" | grep -v "не возвращать" > /dev/null 2>&1; then
  # Check if it's in the response (bad) or just in comments (ok)
  if grep -r "adminId:" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
    echo -e "${RED}❌ FAIL: Admin metadata exposed in response${NC}"
    FAIL=$((FAIL + 1))
  else
    echo -e "${GREEN}✅ PASS: Admin metadata not exposed${NC}"
    PASS=$((PASS + 1))
  fi
else
  echo -e "${GREEN}✅ PASS: Admin metadata not exposed${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 6: Authentication check exists
echo "📋 Check 6: Authentication check exists"
if grep -r "getCurrentUser" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS: Authentication check found${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: No authentication check found${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Check 7: Business ownership verification
echo "📋 Check 7: Business ownership verification"
if grep -r "Business not found. Only business owners" src/app/api/business/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ PASS: Business ownership verification found${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: No business ownership verification${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Check 8: TypeScript compilation
echo "📋 Check 8: TypeScript compilation"
if npx tsc --noEmit 2>&1 | grep -E "business/billing.*error" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: TypeScript compilation errors in business billing${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: TypeScript compilation successful${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 9: ESLint passes
echo "📋 Check 9: ESLint passes"
if npx eslint src/app/api/business/billing 2>&1 | grep -E "error" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: ESLint errors in business billing${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: ESLint successful${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 10: Endpoints exist
echo "📋 Check 10: Required endpoints exist"
if [ -f "src/app/api/business/billing/route.ts" ] && \
   [ -f "src/app/api/business/billing/transactions/route.ts" ]; then
  echo -e "${GREEN}✅ PASS: Both endpoints created${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: Missing endpoints${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SECURITY VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All security checks passed! Business Billing API is secure.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some security checks failed. Please review the errors above.${NC}"
  exit 1
fi
