import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";
import { BusinessShell } from "@/components/business/layout/BusinessShell";
import { Toaster } from "@/components/ui/toaster";
import { headers } from "next/headers";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { BackofficeProviders } from "@/components/providers/BackofficeProviders";
import { getBuildInfo } from "@/lib/system/buildInfo";
export default async function ProtectedBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto");
  // 1. Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  // 2. Partner cabinet: active BusinessMember (OWNER/MANAGER), else owned row; see getPartnerCabinetBusiness.
  // NOTE: ADMIN/MODERATOR users CAN have business access via BusinessMember - don't block by role.
  const business = await getMyBusiness(user.id);

  if (!business) {
    if (user.role === "USER") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "public",
          targetPath: "/me",
          currentHost: host,
          currentProtocol: protocol,
        }),
      );
    }
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  // 3. Check business verification status - redirect to pending if not approved
  const verificationStatus = getEffectiveVerificationStatus(business);
  if (verificationStatus !== "APPROVED") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/verification",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  // 4. Мягкое отключение / архив (публичный контент скрыт; кабинет недоступен до ACTIVE)
  if (business.operationalStatus !== "ACTIVE") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/suspended",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  const billingSummary = await getBusinessBillingSummary(business.id);
  const businessBalanceBYN =
    billingSummary?.account.depositBalance?.toNumber() ?? 0;
  const buildInfo = getBuildInfo();

  return (
    <BackofficeProviders>
      <BusinessShell
        buildInfo={buildInfo}
        user={{
          id: user.id,
          email: user.email,
          role: user.role,
          hasApprovedBusinessProfile: true,
          businessBalanceBYN,
        }}
      >
        {children}
        <Toaster />
      </BusinessShell>
    </BackofficeProviders>
  );
}
