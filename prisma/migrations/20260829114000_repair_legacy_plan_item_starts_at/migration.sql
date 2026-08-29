-- PlanItem.startsAt canonical contract: absolute UTC instant.
--
-- Historical rows may contain the specific legacy bug where Europe/Minsk wall-clock
-- digits were persisted as though they were UTC (for example, 15:00 local stored
-- as 15:00 instead of canonical 12:00 UTC). Repair only rows that can be matched
-- deterministically to exactly one canonical ActivitySession.
--
-- Safety rules:
-- 1. Never touch a PlanItem that already exactly matches any ActivitySession.
-- 2. Require the same activityId.
-- 3. Require the PlanItem date to equal the session's Europe/Minsk local date.
-- 4. Require exactly one legacy wall-clock match.
-- 5. Leave ambiguous/unmatched rows untouched for manual audit.

WITH legacy_candidates AS (
  SELECT
    pi.id AS plan_item_id,
    s.id AS session_id,
    s."startsAt" AS canonical_starts_at
  FROM "PlanItem" pi
  JOIN "ActivitySession" s
    ON s."activityId" = pi."activityId"
  WHERE pi."startsAt" IS NOT NULL
    AND pi."activityId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "ActivitySession" exact_session
      WHERE exact_session."activityId" = pi."activityId"
        AND exact_session."startsAt" = pi."startsAt"
    )
    AND pi.date = TO_CHAR(
      (s."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Minsk',
      'YYYY-MM-DD'
    )
    AND pi."startsAt" = (
      (s."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Minsk'
    )
),
unique_legacy_matches AS (
  SELECT
    plan_item_id,
    MIN(canonical_starts_at) AS canonical_starts_at
  FROM legacy_candidates
  GROUP BY plan_item_id
  HAVING COUNT(*) = 1
)
UPDATE "PlanItem" pi
SET "startsAt" = match.canonical_starts_at
FROM unique_legacy_matches match
WHERE pi.id = match.plan_item_id;
