import type { AccountMenuUser } from "@/lib/account/types";
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
  const hasApprovedBusinessProfile = business
    ? getEffectiveVerificationStatus(business) === "APPROVED"
    : false;

  return {
    ...user,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    hasApprovedBusinessProfile,
  };
}
