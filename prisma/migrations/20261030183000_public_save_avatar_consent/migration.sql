CREATE TABLE "PublicSaveAvatarConsent" (
  "userId" TEXT NOT NULL,
  "textVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicSaveAvatarConsent_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "PublicSaveAvatarConsent_revokedAt_idx" ON "PublicSaveAvatarConsent"("revokedAt");
ALTER TABLE "PublicSaveAvatarConsent" ADD CONSTRAINT "PublicSaveAvatarConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
