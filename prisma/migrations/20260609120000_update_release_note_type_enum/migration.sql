-- Replace ReleaseNoteType enum:
--   old values (UPPERCASE): FEATURE, FIX, IMPROVEMENT, BREAKING, INTERNAL
--   new values (lowercase):  feature, fix, improvement, security
--
-- Data mapping:
--   FEATURE     → feature
--   FIX         → fix
--   IMPROVEMENT → improvement
--   BREAKING    → security
--   INTERNAL    → feature  (closest semantic fit; adjust if needed)

-- 1. Create new enum
CREATE TYPE "ReleaseNoteType_new" AS ENUM ('feature', 'fix', 'improvement', 'security');

-- 2. Add temporary column
ALTER TABLE "ReleaseNote" ADD COLUMN "type_new" "ReleaseNoteType_new";

-- 3. Migrate existing rows
UPDATE "ReleaseNote" SET "type_new" = CASE
  WHEN type = 'FEATURE'     THEN 'feature'::"ReleaseNoteType_new"
  WHEN type = 'FIX'         THEN 'fix'::"ReleaseNoteType_new"
  WHEN type = 'IMPROVEMENT' THEN 'improvement'::"ReleaseNoteType_new"
  WHEN type = 'BREAKING'    THEN 'security'::"ReleaseNoteType_new"
  WHEN type = 'INTERNAL'    THEN 'feature'::"ReleaseNoteType_new"
  ELSE                           'feature'::"ReleaseNoteType_new"
END;

-- 4. Enforce NOT NULL
ALTER TABLE "ReleaseNote" ALTER COLUMN "type_new" SET NOT NULL;

-- 5. Swap columns
ALTER TABLE "ReleaseNote" DROP COLUMN "type";
ALTER TABLE "ReleaseNote" RENAME COLUMN "type_new" TO "type";

-- 6. Swap enum types
DROP TYPE "ReleaseNoteType";
ALTER TYPE "ReleaseNoteType_new" RENAME TO "ReleaseNoteType";
