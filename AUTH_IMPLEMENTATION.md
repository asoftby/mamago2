# Authentication Implementation Summary

## Overview
Implemented minimal custom authentication system with email/password before Business Cabinet schema.

## Database Schema

### User Model
```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  role         String    @default("USER") // USER | BUSINESS_OWNER | MODERATOR | ADMIN
  sessions     Session[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

### Session Model
```prisma
model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

## Files Created

### Core Authentication
- `src/lib/auth/crypto.ts` - Password hashing (scrypt) and token generation
- `src/lib/auth/session.ts` - Session management (create, validate, delete)
- `src/lib/auth/server.ts` - Server helpers (getCurrentUser, requireUser, requireRole)
- `src/lib/prisma.ts` - Prisma client singleton

### API Routes
- `src/app/api/auth/register/route.ts` - POST /api/auth/register
- `src/app/api/auth/login/route.ts` - POST /api/auth/login
- `src/app/api/auth/logout/route.ts` - POST /api/auth/logout

### UI Pages
- `src/app/login/page.tsx` - Login form
- `src/app/register/page.tsx` - Registration form with role selection
- `src/app/auth-test/page.tsx` - Test page to verify authentication

## Features

### Security
- ✅ Passwords hashed with scrypt (salt + 64-byte key)
- ✅ Session tokens hashed with SHA-256 before storage
- ✅ httpOnly secure cookies (mg_session)
- ✅ 30-day session duration
- ✅ Automatic session expiration cleanup

### API Endpoints

#### POST /api/auth/register
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "BUSINESS_OWNER" // optional, defaults to "USER"
}
```

#### POST /api/auth/login
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/logout
No body required. Deletes session and cookie.

### Server Helpers

```typescript
// Get current user (returns null if not authenticated)
const user = await getCurrentUser();

// Require authentication (redirects to /login if not authenticated)
const user = await requireUser();

// Require specific role
const user = await requireRole(["BUSINESS_OWNER", "ADMIN"]);

// Check if user has role
const isAdmin = await hasRole("ADMIN");
```

## Testing

1. Start dev server: `npm run dev`
2. Navigate to `/register` to create an account
3. Select "Business Owner" role
4. After registration, you'll be automatically logged in
5. Visit `/auth-test` to see your user details
6. Test logout functionality

## Next Steps

Now that authentication is working, we can proceed with:
1. Business schema implementation
2. Business subdomain routing
3. Business Cabinet UI

## Migration Applied

```bash
npx prisma migrate dev --name add_user_session_auth
```

Migration created: `20260302085316_add_user_session_auth`
