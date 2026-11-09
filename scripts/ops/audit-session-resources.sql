-- psql -X -v ON_ERROR_STOP=1 -f scripts/ops/audit-session-resources.sql
-- Run with a read-only role. Report only materialized occurrences in the next 90 days.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

WITH bounds AS (
  SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now_utc
), sessions AS (
  SELECT 'OFFER' AS kind, s.id AS session_id, o.id AS publication_id,
    p."ownerBusinessId" AS business_id, s."startAt" AS starts_at, s."endAt" AS ends_at,
    s."isCancelled" AS cancelled, COALESCE(ob."bufferMin", 0) AS buffer_min
  FROM "OfferSession" s
  JOIN "Offer" o ON o.id = s."offerId"
  JOIN "Place" p ON p.id = o."placeId"
  LEFT JOIN "OfferBooking" ob ON ob."offerId" = o.id
  CROSS JOIN bounds b
  WHERE p."ownerBusinessId" IS NOT NULL
    AND s."startAt" >= b.now_utc AND s."startAt" < b.now_utc + interval '90 days'
  UNION ALL
  SELECT 'EVENT', s.id, a.id, a."businessId", s."startsAt", NULL::timestamp,
    s."withdrawnAt" IS NOT NULL, 0
  FROM "ActivitySession" s
  JOIN "Activity" a ON a.id = s."activityId"
  CROSS JOIN bounds b
  WHERE a."businessId" IS NOT NULL
    AND s."startsAt" >= b.now_utc AND s."startsAt" < b.now_utc + interval '90 days'
), requests AS (
  SELECT s.kind, s.session_id, count(*) AS active_requests,
    count(DISTINCT r."classGroupId") AS class_groups,
    sum(r.seats) AS requested_seats
  FROM sessions s
  JOIN LATERAL (
    SELECT "classGroupId", seats, status, "holdUntil" FROM "BookingRequest"
    WHERE s.kind = 'OFFER' AND "offerSessionId" = s.session_id
    UNION ALL
    SELECT "classGroupId", seats, status, "holdUntil" FROM "BookingRequest"
    WHERE s.kind = 'EVENT' AND "selectedSessionId" = s.session_id
  ) r ON true
  CROSS JOIN bounds b
  WHERE r.status = 'CONFIRMED' OR (r.status = 'NEW' AND (r."holdUntil" IS NULL OR r."holdUntil" > b.now_utc))
  GROUP BY s.kind, s.session_id
)
SELECT s.kind, s.session_id, s.publication_id, s.business_id, s.starts_at, s.ends_at, s.cancelled,
  COALESCE(r.active_requests, 0) AS active_requests, COALESCE(r.class_groups, 0) AS class_groups,
  COALESCE(r.requested_seats, 0) AS requested_seats, u.id AS resource_id,
  u.status AS resource_status, u.timezone AS resource_timezone,
  CASE WHEN u.id IS NULL THEN 'UNASSIGNED'
       WHEN u."businessId" <> s.business_id THEN 'FOREIGN_RESOURCE'
       WHEN candidates.assigned THEN 'ASSIGNED' ELSE 'CANDIDATE_ONLY' END AS resource_source,
  CASE WHEN s.ends_at IS NULL OR s.ends_at <= s.starts_at OR u.id IS NULL THEN NULL
       ELSE EXISTS (
         SELECT 1 FROM "BookingAllocation" a
         WHERE a."bookingUnitId" = u.id AND a."partyQuoteId" IS NOT NULL
           AND a.status = 'CONFIRMED'
           AND a."blockStart" < s.ends_at + make_interval(mins => u."cleanupMinutes" + s.buffer_min)
           AND a."blockEnd" > s.starts_at - make_interval(mins => u."prepMinutes")
       ) END AS conflicts_with_confirmed_party,
  CASE WHEN s.ends_at IS NULL OR s.ends_at <= s.starts_at OR u.id IS NULL THEN NULL
       ELSE EXISTS (
         SELECT 1 FROM "CalendarBlock" c
         WHERE c."bookingUnitId" = u.id
           AND c."blockStart" < s.ends_at + make_interval(mins => u."cleanupMinutes" + s.buffer_min)
           AND c."blockEnd" > s.starts_at - make_interval(mins => u."prepMinutes")
       ) END AS conflicts_with_calendar_block
FROM sessions s
LEFT JOIN requests r USING (kind, session_id)
LEFT JOIN LATERAL (
  SELECT resource_id, bool_or(assigned) AS assigned
  FROM (
    SELECT "bookingUnitId" AS resource_id, false AS assigned FROM "BookingUnitOffer"
    WHERE s.kind = 'OFFER' AND "offerId" = s.publication_id
    UNION ALL
    SELECT a."bookingUnitId", true FROM "BookingAllocation" a
    WHERE s.kind = 'OFFER' AND a."offerSessionId" = s.session_id AND a.status = 'CONFIRMED'
    UNION ALL
    SELECT a."bookingUnitId", true FROM "BookingAllocation" a
    WHERE s.kind = 'EVENT' AND a."activitySessionId" = s.session_id AND a.status = 'CONFIRMED'
  ) links GROUP BY resource_id
) candidates ON true
LEFT JOIN "BookingUnit" u ON u.id = candidates.resource_id
ORDER BY s.starts_at, s.kind, s.session_id, u.id;

COMMIT;
