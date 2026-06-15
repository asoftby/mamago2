-- Track wizard steps explicitly completed by the user (offer wizard stepper)
ALTER TABLE "Offer" ADD COLUMN "wizardCompletedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
