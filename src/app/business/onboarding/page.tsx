import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getOwnedBusinessProfile } from "@/server/business/getMyBusiness";
import { OnboardingForm } from "./OnboardingForm";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { loadBusinessContactOtpClientState } from "@/lib/phone-verification/businessContactVerification";

// Ensure Node.js runtime for fetch compatibility
export const runtime = "nodejs";

export default async function OnboardingPage() {
  const routing = await getCurrentRequestRoutingContext();
  // 1. Auth guard
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // 2. Check existing business profile
  const existingBusiness = await getOwnedBusinessProfile(user.id);
  
  // Normalize Business entity to OnboardingForm initialData shape
  const normalizedInitialData = existingBusiness
    ? {
        unp: existingBusiness.unp ?? undefined,
        legalName: existingBusiness.legalName ?? undefined,
        phone: existingBusiness.phone ?? null,
        contactPhoneVerifiedAt: existingBusiness.contactPhoneVerifiedAt
          ? existingBusiness.contactPhoneVerifiedAt.toISOString()
          : null,
      }
    : null;
  
  if (existingBusiness) {
    const verificationStatus = getEffectiveVerificationStatus(existingBusiness);
    
    // APPROVED → dashboard
    if (verificationStatus === "APPROVED") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "business",
          targetPath: "/dashboard",
          ...routing,
        }),
      );
    }
    
    // PENDING → verification page
    if (verificationStatus === "PENDING") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "business",
          targetPath: "/verification",
          ...routing,
        }),
      );
    }
    
    // DRAFT or REJECTED → stay here to edit
  }

  // 3. Render onboarding form
  const isEditing = !!existingBusiness;
  const verificationStatus = existingBusiness 
    ? getEffectiveVerificationStatus(existingBusiness)
    : null;

  const initialBusinessContactOtpState =
    await loadBusinessContactOtpClientState(user.id);

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-0">
      <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">mamaGo Business</p>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
          {isEditing ? "Данные вашей компании" : "Расскажите о вашем бизнесе"}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-stone-600">
          После подтверждения компании вы сможете публиковать места, события и предложения для семей, а также отслеживать их результаты.
        </p>
        
        <div className="space-y-6">
          {isEditing && verificationStatus === "REJECTED" && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                Заявка отклонена
              </h2>
              <p className="text-red-700 text-sm">
                Исправьте данные ниже и отправьте заявку повторно.
              </p>
            </div>
          )}

          {!isEditing && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-stone-900">Первый шаг — подтвердить компанию</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Укажите УНП, юридическое название и контактный номер. После отправки мы покажем статус заявки и познакомим с возможностями mamaGo.
              </p>
            </div>
          )}
          {isEditing && verificationStatus === "NEEDS_INFO" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">Нужно уточнить данные</p>
              <p className="mt-1 text-sm text-amber-900">
                Внесите исправления, которые запросил модератор, и отправьте форму повторно.
              </p>
              {existingBusiness?.reviewNote && <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{existingBusiness.reviewNote}</p>}
            </div>
          )}

          <OnboardingForm
            currentUserId={user.id}
            initialData={normalizedInitialData}
            accountPhoneE164={user.phoneE164 ?? null}
            initialBusinessContactOtpState={initialBusinessContactOtpState}
          />
        </div>
      </div>
    </div>
  );
}
