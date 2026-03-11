-- CreateEnum
CREATE TYPE "OpeningHoursMode" AS ENUM ('WEEKLY', 'ALWAYS_OPEN', 'BY_APPOINTMENT', 'TEMPORARILY_CLOSED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "inheritPlaceOpeningHours" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openingHoursId" TEXT;

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "openingHoursId" TEXT;

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL,
    "mode" "OpeningHoursMode" NOT NULL DEFAULT 'WEEKLY',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Minsk',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHoursRule" (
    "id" TEXT NOT NULL,
    "openingHoursId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "allDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpeningHoursRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHoursInterval" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpeningHoursInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHoursException" (
    "id" TEXT NOT NULL,
    "openingHoursId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "OpeningHoursException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHoursExceptionInterval" (
    "id" TEXT NOT NULL,
    "exceptionId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpeningHoursExceptionInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningHours_mode_idx" ON "OpeningHours"("mode");

-- CreateIndex
CREATE INDEX "OpeningHoursRule_openingHoursId_idx" ON "OpeningHoursRule"("openingHoursId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHoursRule_openingHoursId_dayOfWeek_key" ON "OpeningHoursRule"("openingHoursId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "OpeningHoursInterval_ruleId_sortOrder_idx" ON "OpeningHoursInterval"("ruleId", "sortOrder");

-- CreateIndex
CREATE INDEX "OpeningHoursException_openingHoursId_date_idx" ON "OpeningHoursException"("openingHoursId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHoursException_openingHoursId_date_key" ON "OpeningHoursException"("openingHoursId", "date");

-- CreateIndex
CREATE INDEX "OpeningHoursExceptionInterval_exceptionId_sortOrder_idx" ON "OpeningHoursExceptionInterval"("exceptionId", "sortOrder");

-- CreateIndex
CREATE INDEX "Offer_openingHoursId_idx" ON "Offer"("openingHoursId");

-- CreateIndex
CREATE INDEX "Place_openingHoursId_idx" ON "Place"("openingHoursId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_openingHoursId_fkey" FOREIGN KEY ("openingHoursId") REFERENCES "OpeningHours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHoursRule" ADD CONSTRAINT "OpeningHoursRule_openingHoursId_fkey" FOREIGN KEY ("openingHoursId") REFERENCES "OpeningHours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHoursInterval" ADD CONSTRAINT "OpeningHoursInterval_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "OpeningHoursRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHoursException" ADD CONSTRAINT "OpeningHoursException_openingHoursId_fkey" FOREIGN KEY ("openingHoursId") REFERENCES "OpeningHours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHoursExceptionInterval" ADD CONSTRAINT "OpeningHoursExceptionInterval_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "OpeningHoursException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_openingHoursId_fkey" FOREIGN KEY ("openingHoursId") REFERENCES "OpeningHours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
