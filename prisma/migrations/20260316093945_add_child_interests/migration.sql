-- CreateTable
CREATE TABLE "ChildInterest" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "interestSlug" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildCustomInterest" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedSlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RAW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildCustomInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildInterest_childId_idx" ON "ChildInterest"("childId");

-- CreateIndex
CREATE INDEX "ChildInterest_interestSlug_idx" ON "ChildInterest"("interestSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ChildInterest_childId_interestSlug_key" ON "ChildInterest"("childId", "interestSlug");

-- CreateIndex
CREATE INDEX "ChildCustomInterest_childId_idx" ON "ChildCustomInterest"("childId");

-- CreateIndex
CREATE INDEX "ChildCustomInterest_normalizedSlug_idx" ON "ChildCustomInterest"("normalizedSlug");

-- AddForeignKey
ALTER TABLE "ChildInterest" ADD CONSTRAINT "ChildInterest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildCustomInterest" ADD CONSTRAINT "ChildCustomInterest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
