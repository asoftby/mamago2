-- Backfill: один OWNER-участник на каждый существующий Business (канон = ownerUserId).
-- Идемпотентно: не вставляет дубликат по (businessId, userId).

INSERT INTO "BusinessMember" ("id", "businessId", "userId", "role", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  b.id,
  b."ownerUserId",
  'OWNER'::"BusinessMemberRole",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BusinessMember" m
  WHERE m."businessId" = b.id
    AND m."userId" = b."ownerUserId"
);
