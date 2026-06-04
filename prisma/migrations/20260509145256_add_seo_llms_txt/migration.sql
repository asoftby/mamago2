-- CreateTable
CREATE TABLE "SeoLlmsTxt" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT,
    "content" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoLlmsTxt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoLlmsTxt_citySlug_key" ON "SeoLlmsTxt"("citySlug");

-- CreateIndex
CREATE INDEX "SeoLlmsTxt_updatedAt_idx" ON "SeoLlmsTxt"("updatedAt");
