import type { AccountMenuUser } from "@/lib/account/types";
import { hasVerifiedPhoneForComments } from "@/lib/phone-verification/businessContactVerification.shared";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

export type AuthenticatedAppUser = AccountMenuUser & {
  emailVerifiedAt?: string | null;
};

export async function getCurrentAuthState(): Promise<AuthenticatedAppUser | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const business = await getMyBusiness(user.id);
  const businessVerificationStatus = business
    ? getEffectiveVerificationStatus(business)
    : null;
  const hasApprovedBusinessProfile =
    businessVerificationStatus === "APPROVED";

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    canComment: hasVerifiedPhoneForComments({
      accountPhoneE164: user.phoneE164,
      accountPhoneVerifiedAt: user.phoneVerifiedAt,
      businessContactVerifiedPhoneE164: user.businessContactVerifiedPhoneE164,
      businessContactPhoneVerifiedAt: user.businessContactPhoneVerifiedAt,
    }),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    familyRole: user.familyRole,
    ageBandLabel: user.ageBandLabel,
    preferenceSummary: user.preferenceSummary,
    leisureFormatSummary: user.leisureFormatSummary,
    preferenceSignalIds: user.preferenceSignalIds,
    leisureFormatSignalId: user.leisureFormatSignalId,
    hasApprovedBusinessProfile,
    businessVerificationStatus,
  };
}
