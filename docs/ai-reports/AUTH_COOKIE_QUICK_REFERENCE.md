# Auth Cookie Quick Reference

## Cookie Settings

### Development (mamago.local)
```typescript
{
  name: "mg_session",
  domain: ".mamago.local",  // ← Shares across subdomains
  path: "/",
  httpOnly: true,
  secure: false,            // ← HTTP allowed in dev
  sameSite: "lax",
  maxAge: 2592000           // 30 days in seconds
}
```

### Production (mamago.by)
```typescript
{
  name: "mg_session",
  domain: ".mamago.by",     // ← Shares across subdomains
  path: "/",
  httpOnly: true,
  secure: true,             // ← HTTPS only in prod
  sameSite: "lax",
  maxAge: 2592000           // 30 days in seconds
}
```

## Usage

### Import Helper
```typescript
import { 
  SESSION_COOKIE_NAME, 
  getAuthCookieOptions 
} from "@/lib/auth/cookie";
```

### Set Cookie
```typescript
import { setSessionCookie } from "@/lib/auth/session";

// After successful login/register
const token = await createSession(userId);
await setSessionCookie(token);
```

### Delete Cookie
```typescript
import { deleteSessionCookie } from "@/lib/auth/session";

// On logout
await deleteSessionCookie();
```

### Get Cookie
```typescript
import { getSessionToken } from "@/lib/auth/session";

// Get current session token
const token = await getSessionToken();
```

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getAuthCookieDomain()` | `src/lib/auth/cookie.ts` | Returns domain for environment |
| `getAuthCookieOptions()` | `src/lib/auth/cookie.ts` | Returns complete cookie config |
| `setSessionCookie()` | `src/lib/auth/session.ts` | Sets session cookie |
| `deleteSessionCookie()` | `src/lib/auth/session.ts` | Deletes session cookie |
| `getSessionToken()` | `src/lib/auth/session.ts` | Gets token from cookie |

## Domain Logic

```typescript
if (NODE_ENV === "production") {
  return ".mamago.by";
} else if (NEXT_PUBLIC_APP_URL.includes("mamago.local")) {
  return ".mamago.local";
} else {
  return undefined; // localhost (no subdomain sharing)
}
```

## Testing

### Check Cookie Exists
```bash
# In browser DevTools Console
document.cookie
# Should see: mg_session=<token>
```

### Check Cookie Domain
```
DevTools → Application → Cookies → http://mamago.local:3002
Look for: mg_session
Domain should be: .mamago.local
```

### Test Subdomain Sharing
```
1. Login at http://mamago.local:3002/login
2. Visit http://admin.mamago.local:3002/admin
3. Should NOT redirect to login (cookie shared)
```

## Common Patterns

### After Login
```typescript
// Create session and set cookie
const token = await createSession(user.id);
await setSessionCookie(token);

return NextResponse.json({ success: true, user });
```

### After Logout
```typescript
// Delete session from DB
const token = await getSessionToken();
if (token) {
  await deleteSession(token);
}

// Delete cookie
await deleteSessionCookie();

return NextResponse.redirect("/");
```

### Check Auth
```typescript
// Get current user
const token = await getSessionToken();
if (!token) {
  redirect("/login");
}

const user = await validateSession(token);
if (!user) {
  redirect("/login");
}
```

## Security Checklist

- ✅ HttpOnly: true (prevents XSS)
- ✅ Secure: true in prod (HTTPS only)
- ✅ SameSite: lax (CSRF protection)
- ✅ Domain: .mamago.local/.mamago.by (subdomain sharing)
- ✅ Path: / (available everywhere)
- ✅ MaxAge: 30 days (auto-expire)

## Troubleshooting

### Cookie Not Set
- Check browser DevTools → Network → Response Headers
- Look for `Set-Cookie` header
- Verify domain and secure flags

### Cookie Not Sent
- Check browser DevTools → Network → Request Headers
- Look for `Cookie` header
- Verify domain matches current host

### Cookie Not Deleted
- Ensure `deleteSessionCookie()` uses same domain
- Check `maxAge: 0` is set
- Verify cookie disappears in DevTools

### Subdomain Not Working
- Verify `/etc/hosts` has subdomain entries
- Check domain has leading dot (`.mamago.local`)
- Ensure `NEXT_PUBLIC_APP_URL` includes "mamago.local"
