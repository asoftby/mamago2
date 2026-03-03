-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");
