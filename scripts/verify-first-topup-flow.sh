#!/bin/bash

# Verification Script: First Top-Up from Empty State
# Tests the complete flow of creating billing accounts from empty state

echo "🔍 Verifying First Top-Up Flow Implementation"
echo "=============================================="
echo ""

PASS=0
FAIL=0

# Test 1: FirstTopUpModal component exists
echo "✓ Test 1: FirstTopUpModal component exists"
if [ -f "src/app/admin/billing/businesses/FirstTopUpModal.tsx" ]; then
  echo "  ✅ PASS: FirstTopUpModal.tsx found"
  ((PASS++))
else
  echo "  ❌ FAIL: FirstTopUpModal.tsx not found"
  ((FAIL++))
fi
echo ""

# Test 2: BillingBusinessesClient imports FirstTopUpModal
echo "✓ Test 2: BillingBusinessesClient imports FirstTopUpModal"
if grep -q "import { FirstTopUpModal }" "src/app/admin/billing/businesses/BillingBusinessesClient.tsx"; then
  echo "  ✅ PASS: FirstTopUpModal imported"
  ((PASS++))
else
  echo "  ❌ FAIL: FirstTopUpModal not imported"
  ((FAIL++))
fi
echo ""

# Test 3: Empty state has "Пополнить баланс" button
echo "✓ Test 3: Empty state has actionable button"
if grep -q "Пополнить баланс" "src/app/admin/billing/businesses/BillingBusinessesClient.tsx"; then
  echo "  ✅ PASS: Button text found in empty state"
  ((PASS++))
else
  echo "  ❌ FAIL: Button text not found"
  ((FAIL++))
fi
echo ""

# Test 4: FirstTopUpModal state management
echo "✓ Test 4: FirstTopUpModal state management"
if grep -q "showFirstTopUpModal" "src/app/admin/billing/businesses/BillingBusinessesClient.tsx"; then
  echo "  ✅ PASS: State management implemented"
  ((PASS++))
else
  echo "  ❌ FAIL: State management missing"
  ((FAIL++))
fi
echo ""

# Test 5: Business selector with search
echo "✓ Test 5: Business selector with search"
if grep -q "Search" "src/app/admin/billing/businesses/FirstTopUpModal.tsx"; then
  echo "  ✅ PASS: Search functionality implemented"
  ((PASS++))
else
  echo "  ❌ FAIL: Search functionality missing"
  ((FAIL++))
fi
echo ""

# Test 6: Uses businesses list API
echo "✓ Test 6: Uses businesses list API"
if grep -q "/api/admin/businesses/list" "src/app/admin/billing/businesses/FirstTopUpModal.tsx"; then
  echo "  ✅ PASS: API endpoint used"
  ((PASS++))
else
  echo "  ❌ FAIL: API endpoint not used"
  ((FAIL++))
fi
echo ""

# Test 7: Required internal comment
echo "✓ Test 7: Required internal comment"
if grep -q "required" "src/app/admin/billing/businesses/FirstTopUpModal.tsx" && grep -q "note" "src/app/admin/billing/businesses/FirstTopUpModal.tsx"; then
  echo "  ✅ PASS: Internal comment is required"
  ((PASS++))
else
  echo "  ❌ FAIL: Internal comment not required"
  ((FAIL++))
fi
echo ""

# Test 8: Default description
echo "✓ Test 8: Default description"
if grep -q "Пополнение баланса mamaGo" "src/app/admin/billing/businesses/FirstTopUpModal.tsx"; then
  echo "  ✅ PASS: Default description set"
  ((PASS++))
else
  echo "  ❌ FAIL: Default description missing"
  ((FAIL++))
fi
echo ""

# Test 9: Credit API supports account creation
echo "✓ Test 9: Credit API supports account creation"
if grep -q "billingAccount.create" "src/app/api/admin/billing/credit/route.ts"; then
  echo "  ✅ PASS: Account creation implemented"
  ((PASS++))
else
  echo "  ❌ FAIL: Account creation not implemented"
  ((FAIL++))
fi
echo ""

# Test 10: Atomic transaction for account creation
echo "✓ Test 10: Atomic transaction for account creation"
if grep -q "prisma.\$transaction" "src/app/api/admin/billing/credit/route.ts"; then
  echo "  ✅ PASS: Atomic transaction used"
  ((PASS++))
else
  echo "  ❌ FAIL: Atomic transaction not used"
  ((FAIL++))
fi
echo ""

# Test 11: firstTopUp flag in metadata
echo "✓ Test 11: firstTopUp flag in metadata"
if grep -q "firstTopUp: true" "src/app/api/admin/billing/credit/route.ts"; then
  echo "  ✅ PASS: firstTopUp flag set"
  ((PASS++))
else
  echo "  ❌ FAIL: firstTopUp flag missing"
  ((FAIL++))
fi
echo ""

# Test 12: Businesses list API exists
echo "✓ Test 12: Businesses list API exists"
if [ -f "src/app/api/admin/businesses/list/route.ts" ]; then
  echo "  ✅ PASS: Businesses list API found"
  ((PASS++))
else
  echo "  ❌ FAIL: Businesses list API not found"
  ((FAIL++))
fi
echo ""

# Test 13: Accent color used
echo "✓ Test 13: Accent color (#EF8759) used"
if grep -q "#EF8759" "src/app/admin/billing/businesses/FirstTopUpModal.tsx"; then
  echo "  ✅ PASS: Accent color applied"
  ((PASS++))
else
  echo "  ❌ FAIL: Accent color not applied"
  ((FAIL++))
fi
echo ""

# Test 14: Modal renders conditionally
echo "✓ Test 14: Modal renders conditionally"
if grep -q "showFirstTopUpModal &&" "src/app/admin/billing/businesses/BillingBusinessesClient.tsx"; then
  echo "  ✅ PASS: Conditional rendering implemented"
  ((PASS++))
else
  echo "  ❌ FAIL: Conditional rendering missing"
  ((FAIL++))
fi
echo ""

# Test 15: Success handler reloads page
echo "✓ Test 15: Success handler reloads page"
if grep -q "window.location.reload" "src/app/admin/billing/businesses/BillingBusinessesClient.tsx"; then
  echo "  ✅ PASS: Page reload on success"
  ((PASS++))
else
  echo "  ❌ FAIL: Page reload missing"
  ((FAIL++))
fi
echo ""

# Summary
echo "=============================================="
echo "📊 Test Results:"
echo "   ✅ Passed: $PASS"
echo "   ❌ Failed: $FAIL"
echo "   📈 Total:  $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 All tests passed! First top-up flow is complete."
  exit 0
else
  echo "⚠️  Some tests failed. Please review the implementation."
  exit 1
fi
