-- AlterTable
ALTER TABLE "PlaceReview" ADD COLUMN     "ownerReplyAuthorId" TEXT,
ADD COLUMN     "ownerReplyAuthorName" TEXT,
ADD COLUMN     "ownerReplyCreatedAt" TIMESTAMP(3),
ADD COLUMN     "ownerReplyText" TEXT,
ADD COLUMN     "ownerReplyUpdatedAt" TIMESTAMP(3);
