import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BusinessShell } from "@/components/business/layout/BusinessShell";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";
import { getBuildInfo } from "@/lib/system/buildInfo";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

export const metadata: Metadata = {
  robots: PERMANENT_NOINDEX_ROBOTS,
};

export default async function UnifiedSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  const cookieStore = await cookies();
  const mode = cookieStore.get("mamago_mode")?.value;
  const preferBusinessLayout =
    mode === "business" && context.permissions.canAccessBusinessSettings;

  if (!preferBusinessLayout) {
    return <>{children}</>;
  }

  const businessId = context.businessContext?.id ?? null;
  const billingSummary = businessId
    ? await getBusinessBillingSummary(businessId)
    : null;
  const buildInfo = getBuildInfo();

  return (
    <BusinessShell
      buildInfo={buildInfo}
      user={{
        id: context.viewer.id,
        email: context.viewer.email,
        role: context.viewer.role,
        hasApprovedBusinessProfile:
          context.businessContext?.verificationStatus === "APPROVED",
        businessBalanceBYN:
          billingSummary?.account.depositBalance?.toNumber() ?? 0,
      }}
    >
      {children}
    </BusinessShell>
  );
}
