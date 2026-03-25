import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { OnboardingForm } from "./OnboardingForm";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

// Ensure Node.js runtime for fetch compatibility
export const runtime = "nodejs";

export default async function OnboardingPage() {
  // 1. Auth guard
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // 2. Check existing business profile
  const existingBusiness = await getMyBusiness(user.id);
  
  if (existingBusiness) {
    const verificationStatus = getEffectiveVerificationStatus(existingBusiness);
    
    // APPROVED → dashboard
    if (verificationStatus === "APPROVED") {
      redirect("/business/dashboard");
    }
    
    // PENDING → verification page
    if (verificationStatus === "PENDING") {
      redirect("/business/verification");
    }
    
    // DRAFT or REJECTED → stay here to edit
  }

  // 3. Render onboarding form
  const isEditing = !!existingBusiness;
  const verificationStatus = existingBusiness 
    ? getEffectiveVerificationStatus(existingBusiness)
    : null;

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
            initialData={existingBusiness}
            accountPhoneE164={user.phoneE164 ?? null}
          />
        </div>
      </div>
    </div>
  );
}
