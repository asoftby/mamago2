-- Account-scoped Home selection. No Child FK: current family ACL is validated on every read/write.
CREATE TABLE "UserHomePreference" (
    "userId" TEXT NOT NULL,
    "selectedChildId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserHomePreference_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserHomePreference" ADD CONSTRAINT "UserHomePreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
