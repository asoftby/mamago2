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
    redirect("/login");
  }

  // Кабинет партнёра — только владельцы бизнеса; остальные роли — в свои разделы
  if (user.role === "USER") {
    redirect("/me");
  }
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    redirect("/admin");
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

  // 4. Мягкое отключение / архив (публичный контент скрыт; кабинет недоступен до ACTIVE)
  if (business.operationalStatus !== "ACTIVE") {
    redirect("/business/suspended");
  }

  return (
    <BusinessShell
      user={{
        id: user.id,
        email: user.email,
        role: user.role,
      }}
    >
      {children}
    </BusinessShell>
  );
}
