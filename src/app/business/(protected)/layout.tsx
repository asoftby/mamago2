import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import { BusinessShell } from "@/components/business/layout/BusinessShell";

export default async function ProtectedBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=business");
  }

  // 2. Check if Business exists (onboarding gate)
  const business = await getMyBusiness(user.id);
  
  if (!business) {
    redirect("/business/onboarding");
  }

  // 3. Check business verification status - redirect to pending if not approved
  const verificationStatus = getEffectiveVerificationStatus(business);
  if (verificationStatus !== "APPROVED") {
    redirect("/business/verification");
  }

  return (
    <BusinessShell userEmail={user.email || undefined}>
      {children}
    </BusinessShell>
  );
}
