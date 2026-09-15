-- Keep the shared age SignalDefinition aligned with the canonical mamaGo age scale.
-- Historical/non-canonical SignalOption rows are preserved for auditability, but
-- are deactivated so they cannot leak back into Event Wizard or other selectors.
-- Canonical values:
-- 0-1, 1-3, 3-5, 5-7, 7-9, 9-12, 12-14, 14-16, 16-18, 18+

UPDATE "SignalOption" AS so
SET "isActive" = false
FROM "SignalDefinition" AS sd
WHERE so."definitionId" = sd."id"
  AND sd."slug" = 'age'
  AND so."isActive" = true
  AND so."value" NOT IN (
    '0-1',
    '1-3',
    '3-5',
    '5-7',
    '7-9',
    '9-12',
    '12-14',
    '14-16',
    '16-18',
    '18+'
  );
