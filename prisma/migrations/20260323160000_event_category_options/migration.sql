-- CreateTable
CREATE TABLE "EventCategoryOption" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EventCategoryOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategoryOption_categoryId_value_key" ON "EventCategoryOption"("categoryId", "value");

-- CreateIndex
CREATE INDEX "EventCategoryOption_categoryId_isActive_order_idx" ON "EventCategoryOption"("categoryId", "isActive", "order");

-- AddForeignKey
ALTER TABLE "EventCategoryOption" ADD CONSTRAINT "EventCategoryOption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
