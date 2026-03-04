# Admin Bootstrap & Role Management

Complete guide for bootstrapping the first admin and managing user roles.

---

## 🚀 Quick Start: Bootstrap First Admin

### Step 1: Register User Account
First, create a user account through the normal registration flow at `/register`.

### Step 2: Run Bootstrap Script
```bash
ADMIN_BOOTSTRAP_EMAIL=asoftby@gmail.com pnpm bootstrap:admin
```

**Output:**
```
[bootstrap-admin] Starting...

📧 Looking for user: asoftby@gmail.com
✓ User found: Alex (ID: cm5abc123...)
  Current role: USER

✅ SUCCESS: User promoted to ADMIN

Details:
  User ID:       cm5abc123...
  Email:         asoftby@gmail.com
  Previous role: USER
  New role:      ADMIN

📝 Note: Role changes take effect immediately (no re-login required).

You can now access admin routes at /admin/*
```

### Step 3: Verify Access
Navigate to `/admin/business/verification` or any admin route. You should have access immediately.

---

## 🔐 How It Works

### Authentication System
The system uses **session-based authentication** with database-backed sessions:

1. Session token stored in httpOnly cookie
2. On each request, `validateSession()` reads from database
3. User object (including role) fetched fresh from DB
4. **Result:** Role changes take effect immediately, no re-login required

### Role Hierarchy
```
USER      → Default role for all registered users
BUSINESS  → Business account owners (future use)
EDITOR    → Content editors (future use)
ADMIN     → Full system access
```

---

## 📋 Bootstrap Script Details

### Location
`scripts/bootstrap-admin.ts`

### Usage
```bash
# Basic usage
ADMIN_BOOTSTRAP_EMAIL=user@example.com pnpm bootstrap:admin

# Or with explicit tsx
ADMIN_BOOTSTRAP_EMAIL=user@example.com pnpm tsx scripts/bootstrap-admin.ts
```

### Behavior
- ✅ Validates email format
- ✅ Checks if user exists (exits with error if not found)
- ✅ Checks if already ADMIN (exits successfully if already promoted)
- ✅ Updates role in database
- ✅ Logs previous and new role
- ✅ Safe to run multiple times (idempotent)

### Exit Codes
- `0` - Success (promoted or already admin)
- `1` - Error (missing email, invalid format, user not found, or unexpected error)

---

## 🔧 API Endpoint: Promote User

### Endpoint
```
POST /api/admin/users/promote
```

### Authentication
- Requires active session
- Requires ADMIN role
- Returns 401 if not authenticated
- Returns 403 if not ADMIN

### Request Body
```json
{
  "email": "user@example.com",
  "role": "ADMIN"  // Optional, defaults to "ADMIN"
}
```

**Valid roles:** `ADMIN`, `MODERATOR`, `BUSINESS_OWNER`, `USER`

### Response (Success)
```json
{
  "success": true,
  "targetUserId": "cm5abc123...",
  "previousRole": "USER",
  "newRole": "ADMIN",
  "message": "Пользователь user@example.com успешно изменен с USER на ADMIN",
  "note": "Изменения вступают в силу немедленно (повторный вход не требуется)"
}
```

### Response (Already Has Role)
```json
{
  "success": true,
  "targetUserId": "cm5abc123...",
  "previousRole": "ADMIN",
  "newRole": "ADMIN",
  "message": "Пользователь user@example.com уже имеет роль ADMIN",
  "noChangeNeeded": true
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Пользователь с email \"user@example.com\" не найден"
}
```

---

## 🧪 Testing & Verification

### Test 1: Bootstrap Script Changes Role
```bash
# Before: Check role in Prisma Studio (should be USER)
# Run bootstrap
ADMIN_BOOTSTRAP_EMAIL=asoftby@gmail.com pnpm bootstrap:admin
# After: Check role in Prisma Studio (should be ADMIN)
```

### Test 2: Admin Access Works
```bash
# After bootstrap, navigate to:
# http://localhost:3000/admin/business/verification
# Should load without redirect to login
```

### Test 3: Non-Admin Gets 403
```bash
# As non-admin user, try to promote someone:
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=<non-admin-session-token>" \
  -d '{"email":"other@example.com","role":"ADMIN"}'

# Expected response:
# {"success":false,"error":"Доступ запрещен. Требуется роль ADMIN"}
# Status: 403
```

### Test 4: Admin Can Promote Others
```bash
# As admin user:
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=<admin-session-token>" \
  -d '{"email":"editor@example.com","role":"EDITOR"}'

# Expected response:
# {"success":true,"targetUserId":"...","previousRole":"USER","newRole":"EDITOR",...}
# Status: 200
```

---

## 📝 Usage Examples

### Example 1: Bootstrap First Admin
```bash
# User "asoftby@gmail.com" has registered
ADMIN_BOOTSTRAP_EMAIL=asoftby@gmail.com pnpm bootstrap:admin
```

### Example 2: Promote User to Moderator (via API)
```bash
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=YOUR_ADMIN_SESSION_TOKEN" \
  -d '{
    "email": "moderator@example.com",
    "role": "MODERATOR"
  }'
```

### Example 3: Promote User to Business Owner (via API)
```bash
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=YOUR_ADMIN_SESSION_TOKEN" \
  -d '{
    "email": "business@example.com",
    "role": "BUSINESS_OWNER"
  }'
```

### Example 4: Promote User to Admin (via API)
```bash
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=YOUR_ADMIN_SESSION_TOKEN" \
  -d '{
    "email": "newadmin@example.com",
    "role": "ADMIN"
  }'
```

### Example 5: Demote User to Regular User
```bash
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=YOUR_ADMIN_SESSION_TOKEN" \
  -d '{
    "email": "formeradmin@example.com",
    "role": "USER"
  }'
```

---

## 🔒 Security Considerations

### Bootstrap Script
- ✅ Requires direct server access (cannot be called from web)
- ✅ Requires environment variable (not hardcoded)
- ✅ Validates email format
- ✅ Checks user existence
- ✅ Idempotent (safe to run multiple times)

### API Endpoint
- ✅ Requires authentication (session cookie)
- ✅ Requires ADMIN role (403 for non-admins)
- ✅ Validates email format
- ✅ Validates role enum
- ✅ Logs all role changes with actor and target
- ✅ Not exposed in UI (internal use only)

### Session System
- ✅ Reads role from database on each request
- ✅ No stale role data in session
- ✅ Changes take effect immediately
- ✅ HttpOnly cookies (XSS protection)
- ✅ Secure flag in production (HTTPS only)

---

## 🐛 Troubleshooting

### Problem: "User not found"
**Solution:** Ensure user has registered first at `/register`

### Problem: "ADMIN_BOOTSTRAP_EMAIL is required"
**Solution:** Set environment variable:
```bash
ADMIN_BOOTSTRAP_EMAIL=your@email.com pnpm bootstrap:admin
```

### Problem: "Cannot access /admin routes"
**Solution:** 
1. Check role in Prisma Studio: `User.role` should be `ADMIN`
2. Clear browser cookies and re-login
3. Check server logs for auth errors

### Problem: "403 Forbidden" when calling promote API
**Solution:** 
1. Ensure you're logged in as ADMIN
2. Check session cookie is being sent
3. Verify current user role: `await getCurrentUser()` should return role=ADMIN

### Problem: Role change not taking effect
**Solution:** This should not happen with our system (DB-backed sessions), but if it does:
1. Check `validateSession()` is including user: `include: { user: true }`
2. Verify session is not expired
3. Clear all sessions and re-login

---

## 📊 Audit Logging

All role changes are logged to console with:
- Actor user ID and email
- Target user ID and email
- Previous role
- New role
- Timestamp (ISO 8601)

**Example log:**
```json
{
  "actorUserId": "cm5admin123",
  "actorEmail": "admin@example.com",
  "targetUserId": "cm5user456",
  "targetEmail": "editor@example.com",
  "previousRole": "USER",
  "newRole": "EDITOR",
  "timestamp": "2026-03-03T12:34:56.789Z"
}
```

---

## 🎯 Best Practices

1. **Bootstrap First Admin Early**
   - Run bootstrap script immediately after first deployment
   - Use a dedicated admin email address

2. **Use API for Subsequent Promotions**
   - Bootstrap script is for initial admin only
   - Use `/api/admin/users/promote` for all other role changes

3. **Audit Role Changes**
   - Monitor server logs for role change events
   - Consider adding database audit table (future enhancement)

4. **Principle of Least Privilege**
   - Only promote users who need admin access
   - Use EDITOR or BUSINESS roles when appropriate
   - Regularly review admin user list

5. **Secure Admin Sessions**
   - Use strong passwords for admin accounts
   - Consider 2FA for admin users (future enhancement)
   - Rotate admin accounts periodically

---

## 🔗 Related Files

- `scripts/bootstrap-admin.ts` - Bootstrap script
- `src/app/api/admin/users/promote/route.ts` - Promote API endpoint
- `src/lib/auth/server.ts` - Auth helpers (getCurrentUser, requireRole)
- `src/lib/auth/session.ts` - Session management (validateSession)
- `src/server/services/userRole.service.ts` - Legacy promote/demote functions
- `prisma/schema.prisma` - User model with role enum

---

## ✅ Verification Checklist

- [ ] User registered at `/register`
- [ ] Bootstrap script executed successfully
- [ ] User role is ADMIN in database
- [ ] Can access `/admin/*` routes
- [ ] Non-admin users get 403 when calling promote API
- [ ] Admin users can promote others via API
- [ ] Role changes logged to console
- [ ] No re-login required after role change

---

**Last Updated:** March 3, 2026  
**Version:** 1.0.0
