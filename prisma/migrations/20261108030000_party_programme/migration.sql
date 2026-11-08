ALTER TABLE "PartyOrder"
  ADD COLUMN "programme" JSONB,
  ADD COLUMN "programmeAdultIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "programmeChildIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "publicPlanToken" TEXT,
  ADD COLUMN "publicPlanExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "PartyOrder_publicPlanToken_key" ON "PartyOrder"("publicPlanToken");
ALTER TABLE "PartyOrder" ADD CONSTRAINT "PartyOrder_public_plan_expiry_check"
  CHECK (("publicPlanToken" IS NULL) = ("publicPlanExpiresAt" IS NULL));
