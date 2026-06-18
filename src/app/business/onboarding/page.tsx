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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {isEditing ? "Редактировать профиль бизнеса" : "mamaGo Business"}
        </h1>
        
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
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">
                Создайте профиль компании
              </h2>
              <p className="text-blue-700 text-sm">
                Заполните данные ниже — после проверки вы сможете добавлять свои публикации
                (места, события, предложения).
              </p>
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
