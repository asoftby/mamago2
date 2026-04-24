-- Add soft-delete marker for users
ALTER TABLE "User"
ADD COLUMN "deletedAt" TIMESTAMP(3);
