CREATE TYPE "BirthPrecision" AS ENUM ('DAY', 'MONTH');

ALTER TABLE "Child"
ADD COLUMN "birthPrecision" "BirthPrecision",
ALTER COLUMN "name" DROP NOT NULL;
