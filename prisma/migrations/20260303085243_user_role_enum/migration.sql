/*
  Warnings:

  - Changed the type of `role` on the `User` table from String to Role enum.
  - This migration safely preserves existing role data.

  Migration Strategy:
  1. Create the Role enum type
  2. Normalize existing role data (trim, uppercase)
  3. Convert any invalid/unknown roles to 'USER' (fail-safe)
  4. Drop the default temporarily
  5. Alter column type to use the enum
  6. Restore the default
*/

-- Step 1: Create enum type
CREATE TYPE "Role" AS ENUM ('USER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN');

-- Step 2: Normalize existing data (trim whitespace, uppercase)
UPDATE "User"
SET role = UPPER(TRIM(role))
WHERE role IS NOT NULL;

-- Step 3: Convert invalid/unknown roles to 'USER' (fail-safe)
-- This ensures all values are valid before type conversion
UPDATE "User"
SET role = 'USER'
WHERE role NOT IN ('USER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN');

-- Step 4: Drop the default temporarily
ALTER TABLE "User"
ALTER COLUMN "role" DROP DEFAULT;

-- Step 5: Alter column type to enum using safe cast
ALTER TABLE "User"
ALTER COLUMN "role" TYPE "Role" USING role::"Role";

-- Step 6: Restore the default
ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'USER'::"Role";
