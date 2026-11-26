-- Short, unique numeric reference for booking support calls.
-- Existing primary keys and foreign keys remain unchanged.
CREATE SEQUENCE "BookingRequest_requestNumber_seq" START WITH 100001 INCREMENT BY 1;
ALTER TABLE "BookingRequest" ADD COLUMN "requestNumber" INTEGER;
ALTER TABLE "BookingRequest"
  ALTER COLUMN "requestNumber" SET DEFAULT nextval('"BookingRequest_requestNumber_seq"'::regclass);
ALTER SEQUENCE "BookingRequest_requestNumber_seq"
  OWNED BY "BookingRequest"."requestNumber";

-- Backfill historical STANDARD and PARTY requests before enforcing NOT NULL.
UPDATE "BookingRequest"
  SET "requestNumber" = nextval('"BookingRequest_requestNumber_seq"'::regclass)
  WHERE "requestNumber" IS NULL;

ALTER TABLE "BookingRequest" ALTER COLUMN "requestNumber" SET NOT NULL;
CREATE UNIQUE INDEX "BookingRequest_requestNumber_key"
  ON "BookingRequest"("requestNumber");
