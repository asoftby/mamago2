#!/bin/bash
# Test script for /api/admin/users/promote endpoint
# This demonstrates the API structure and expected responses

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Admin Promote API - Test Examples                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Promote User to MODERATOR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo "  POST http://localhost:3000/api/admin/users/promote"
echo "  Headers:"
echo "    Content-Type: application/json"
echo "    Cookie: mg_session=<ADMIN_SESSION_TOKEN>"
echo "  Body:"
echo '    {"email":"moderator@example.com","role":"MODERATOR"}'
echo ""
echo "Expected Response (200):"
cat << 'EOF'
{
  "success": true,
  "targetUserId": "cm5user123...",
  "previousRole": "USER",
  "newRole": "MODERATOR",
  "message": "Пользователь moderator@example.com успешно изменен с USER на MODERATOR",
  "note": "Изменения вступают в силу немедленно (повторный вход не требуется)"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Promote User to ADMIN (default role)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo "  POST http://localhost:3000/api/admin/users/promote"
echo "  Body:"
echo '    {"email":"newadmin@example.com"}'
echo "  Note: role defaults to ADMIN if omitted"
echo ""
echo "Expected Response (200):"
cat << 'EOF'
{
  "success": true,
  "targetUserId": "cm5user456...",
  "previousRole": "USER",
  "newRole": "ADMIN",
  "message": "Пользователь newadmin@example.com успешно изменен с USER на ADMIN",
  "note": "Изменения вступают в силу немедленно (повторный вход не требуется)"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: User Already Has Role (Idempotent)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo '    {"email":"moderator@example.com","role":"MODERATOR"}'
echo ""
echo "Expected Response (200):"
cat << 'EOF'
{
  "success": true,
  "targetUserId": "cm5user123...",
  "previousRole": "MODERATOR",
  "newRole": "MODERATOR",
  "message": "Пользователь moderator@example.com уже имеет роль MODERATOR",
  "noChangeNeeded": true
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Non-Admin User (403 Forbidden)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo "  Cookie: mg_session=<NON_ADMIN_SESSION_TOKEN>"
echo '  Body: {"email":"other@example.com","role":"ADMIN"}'
echo ""
echo "Expected Response (403):"
cat << 'EOF'
{
  "success": false,
  "error": "Доступ запрещен. Требуется роль ADMIN"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: User Not Found (404)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo '    {"email":"nonexistent@example.com","role":"ADMIN"}'
echo ""
echo "Expected Response (404):"
cat << 'EOF'
{
  "success": false,
  "error": "Пользователь с email \"nonexistent@example.com\" не найден"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: Invalid Role (400)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo '    {"email":"user@example.com","role":"SUPERADMIN"}'
echo ""
echo "Expected Response (400):"
cat << 'EOF'
{
  "success": false,
  "error": "Неверная роль. Допустимые значения: ADMIN, MODERATOR, BUSINESS_OWNER, USER"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 7: Missing Email (400)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo '    {"role":"ADMIN"}'
echo ""
echo "Expected Response (400):"
cat << 'EOF'
{
  "success": false,
  "error": "Email обязателен"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 8: Invalid Email Format (400)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Request:"
echo '    {"email":"not-an-email","role":"ADMIN"}'
echo ""
echo "Expected Response (400):"
cat << 'EOF'
{
  "success": false,
  "error": "Неверный формат email"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Audit Logging"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Every successful role change is logged to console:"
cat << 'EOF'
[admin/users/promote] Role change: {
  actorUserId: "cmm91p5n60000wsnnvke0ryoz",
  actorEmail: "asoftby@gmail.com",
  targetUserId: "cm5user123...",
  targetEmail: "moderator@example.com",
  previousRole: "USER",
  newRole: "MODERATOR",
  timestamp: "2026-03-03T12:34:56.789Z"
}
EOF
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "How to Get Session Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Login as admin user in browser"
echo "2. Open DevTools (F12)"
echo "3. Go to Application > Cookies"
echo "4. Find cookie named: mg_session"
echo "5. Copy the value"
echo "6. Use in curl:"
echo ""
echo '   curl -X POST http://localhost:3000/api/admin/users/promote \'
echo '     -H "Content-Type: application/json" \'
echo '     -H "Cookie: mg_session=<PASTE_TOKEN_HERE>" \'
echo '     -d '"'"'{"email":"user@example.com","role":"MODERATOR"}'"'"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Valid Roles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ADMIN          - Full system access"
echo "  MODERATOR      - Content moderation"
echo "  BUSINESS_OWNER - Business account owner"
echo "  USER           - Regular user (default)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests documented"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
