-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_ACTIVATION';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "UserActionTokenPurpose" AS ENUM ('MIGRATED_ACCOUNT_ACTIVATION');

-- CreateTable
CREATE TABLE "UserActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "UserActionTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserActionToken_tokenHash_key" ON "UserActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserActionToken_userId_purpose_createdAt_idx" ON "UserActionToken"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "UserActionToken_purpose_expiresAt_idx" ON "UserActionToken"("purpose", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserActionToken" ADD CONSTRAINT "UserActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
