CREATE TABLE "SectionSystemFilter" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionSystemFilter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionSystemFilter_sectionKey_type_key" ON "SectionSystemFilter"("sectionKey", "type");
CREATE INDEX "SectionSystemFilter_sectionKey_enabled_idx" ON "SectionSystemFilter"("sectionKey", "enabled");
