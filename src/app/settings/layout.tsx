import { cookies } from "next/headers";
import { BusinessShell } from "@/components/business/layout/BusinessShell";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";

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

  return (
    <BusinessShell
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
