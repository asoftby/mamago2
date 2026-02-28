-- CreateTable
CREATE TABLE "SignalDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalOption" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SignalOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ui" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterOption" (
    "id" TEXT NOT NULL,
    "filterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FilterOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalDefinition_slug_key" ON "SignalDefinition"("slug");

-- CreateIndex
CREATE INDEX "SignalOption_definitionId_isActive_order_idx" ON "SignalOption"("definitionId", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SignalOption_definitionId_value_key" ON "SignalOption"("definitionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "FilterDefinition_slug_key" ON "FilterDefinition"("slug");

-- CreateIndex
CREATE INDEX "FilterOption_filterId_isActive_order_idx" ON "FilterOption"("filterId", "isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FilterOption_filterId_value_key" ON "FilterOption"("filterId", "value");

-- AddForeignKey
ALTER TABLE "SignalOption" ADD CONSTRAINT "SignalOption_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "SignalDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilterOption" ADD CONSTRAINT "FilterOption_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "FilterDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
