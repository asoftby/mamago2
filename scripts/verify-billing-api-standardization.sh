#!/bin/bash

# Verification script for Admin Billing API Standardization
# This script checks that all billing routes follow the standardization rules

echo "🔍 Verifying Admin Billing API Standardization..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Check 1: No direct prisma.billingAccount.update in routes
echo "📋 Check 1: No direct prisma.billingAccount.update in routes"
if grep -r "prisma\.billingAccount\.update" src/app/api/admin/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: Found direct prisma.billingAccount.update in routes${NC}"
  grep -r "prisma\.billingAccount\.update" src/app/api/admin/billing --include="*.ts"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: No direct prisma.billingAccount.update found${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 2: No direct prisma.billingTransaction.create in routes
echo "📋 Check 2: No direct prisma.billingTransaction.create in routes"
if grep -r "prisma\.billingTransaction\.create" src/app/api/admin/billing --include="*.ts" > /dev/null 2>&1; then
  echo -e "${RED}❌ FAIL: Found direct prisma.billingTransaction.create in routes${NC}"
  grep -r "prisma\.billingTransaction\.create" src/app/api/admin/billing --include="*.ts"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: No direct prisma.billingTransaction.create found${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 3: All POST routes use Zod validation
echo "📋 Check 3: All POST routes use Zod validation"
POST_ROUTES=$(find src/app/api/admin/billing -name "route.ts" -type f -exec grep -l "export async function POST" {} \;)
ROUTES_WITHOUT_ZOD=0
for route in $POST_ROUTES; do
  if ! grep -q "safeParse" "$route"; then
    echo -e "${RED}❌ Route without Zod: $route${NC}"
    ROUTES_WITHOUT_ZOD=$((ROUTES_WITHOUT_ZOD + 1))
  fi
done

if [ "$ROUTES_WITHOUT_ZOD" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $ROUTES_WITHOUT_ZOD POST routes without Zod validation${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: All POST routes use Zod validation${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 4: All POST routes import from validation/billing
echo "📋 Check 4: All POST routes import from validation/billing"
POST_ROUTES=$(find src/app/api/admin/billing -name "route.ts" -type f -exec grep -l "export async function POST" {} \;)
ROUTES_WITHOUT_VALIDATION=0
for route in $POST_ROUTES; do
  if ! grep -q "@/lib/validation/billing" "$route"; then
    echo -e "${YELLOW}⚠️  Route without validation import: $route${NC}"
    ROUTES_WITHOUT_VALIDATION=$((ROUTES_WITHOUT_VALIDATION + 1))
  fi
done

if [ "$ROUTES_WITHOUT_VALIDATION" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $ROUTES_WITHOUT_VALIDATION POST routes without validation import${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: All POST routes import validation schemas${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 5: All routes check for ADMIN role
echo "📋 Check 5: All routes check for ADMIN role"
ROUTES_WITHOUT_AUTH=$(grep -L "user.role !== \"ADMIN\"" src/app/api/admin/billing/**/route.ts 2>/dev/null | wc -l)
if [ "$ROUTES_WITHOUT_AUTH" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $ROUTES_WITHOUT_AUTH routes without ADMIN check${NC}"
  grep -L "user.role !== \"ADMIN\"" src/app/api/admin/billing/**/route.ts 2>/dev/null
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: All routes check for ADMIN role${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 6: Service functions are atomic (use prisma.$transaction)
echo "📋 Check 6: Service functions are atomic"
SERVICE_FILE="src/server/services/billing/billingTransaction.service.ts"
if grep -q "prisma\.\$transaction" "$SERVICE_FILE"; then
  echo -e "${GREEN}✅ PASS: createRefund uses prisma.\$transaction${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: createRefund does not use prisma.\$transaction${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Check 7: TypeScript compilation
echo "📋 Check 7: TypeScript compilation"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌ FAIL: TypeScript compilation errors found${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: TypeScript compilation successful${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 8: ESLint passes
echo "📋 Check 8: ESLint passes"
if npx eslint src/app/api/admin/billing src/server/services/billing src/lib/validation/billing.ts 2>&1 | grep -q "error"; then
  echo -e "${RED}❌ FAIL: ESLint errors found${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}✅ PASS: ESLint successful${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# Check 9: Validation schemas exist
echo "📋 Check 9: Validation schemas exist"
if [ -f "src/lib/validation/billing.ts" ]; then
  SCHEMA_COUNT=$(grep -c "export const.*Schema" src/lib/validation/billing.ts)
  echo -e "${GREEN}✅ PASS: Found $SCHEMA_COUNT validation schemas${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: Validation file not found${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Check 10: New endpoints exist
echo "📋 Check 10: New endpoints exist"
if [ -f "src/app/api/admin/billing/businesses/route.ts" ] && \
   [ -f "src/app/api/admin/billing/businesses/[businessId]/transactions/route.ts" ]; then
  echo -e "${GREEN}✅ PASS: New endpoints created${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ FAIL: New endpoints not found${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed! Admin Billing API is properly standardized.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some checks failed. Please review the errors above.${NC}"
  exit 1
fi
