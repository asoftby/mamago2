# Admin Bootstrap - Quick Start

**Goal:** Make `asoftby@gmail.com` an ADMIN user.

---

## ✅ Step-by-Step

### 1. Ensure User is Registered
The user must have an account. If not, register at:
```
http://localhost:3000/register
```

### 2. Run Bootstrap Script
```bash
ADMIN_BOOTSTRAP_EMAIL=asoftby@gmail.com pnpm bootstrap:admin
```

**Expected Output:**
```
[bootstrap-admin] Starting...

📧 Looking for user: asoftby@gmail.com
✓ User found (ID: cmm91p5n60000wsnnvke0ryoz)
  Current role: USER

✅ SUCCESS: User promoted to ADMIN

Details:
  User ID:       cmm91p5n60000wsnnvke0ryoz
  Email:         asoftby@gmail.com
  Previous role: USER
  New role:      ADMIN

📝 Note: Role changes take effect immediately (no re-login required).

You can now access admin routes at /admin/*
```

### 3. Verify Access
Navigate to any admin route:
```
http://localhost:3000/admin/business/verification
```

You should have immediate access (no re-login needed).

---

## 🔧 Promote Other Users (After Bootstrap)

Once you're an admin, use the API to promote others:

```bash
curl -X POST http://localhost:3000/api/admin/users/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: mg_session=YOUR_SESSION_TOKEN" \
  -d '{
    "email": "editor@example.com",
    "role": "EDITOR"
  }'
```

**Available Roles:**
- `ADMIN` - Full system access
- `MODERATOR` - Content moderation
- `BUSINESS_OWNER` - Business account owner
- `USER` - Regular user (default)

---

## 🐛 Troubleshooting

### "User not found"
→ User must register first at `/register`

### "ADMIN_BOOTSTRAP_EMAIL is required"
→ Set the environment variable:
```bash
ADMIN_BOOTSTRAP_EMAIL=your@email.com pnpm bootstrap:admin
```

### "User is already ADMIN"
→ Success! No changes needed. Script is idempotent.

---

## 📚 Full Documentation

See `docs/ADMIN_BOOTSTRAP.md` for complete details including:
- How the auth system works
- API endpoint documentation
- Security considerations
- Testing procedures
- Audit logging

---

**Quick Links:**
- Bootstrap Script: `scripts/bootstrap-admin.ts`
- API Endpoint: `src/app/api/admin/users/promote/route.ts`
- Full Docs: `docs/ADMIN_BOOTSTRAP.md`
