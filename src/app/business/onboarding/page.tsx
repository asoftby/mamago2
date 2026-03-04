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
    redirect("/register?from=business");
  }

  // 2. Check existing business profile
  const existingBusiness = await getMyBusiness(user.id);
  
  if (existingBusiness) {
    // Allow editing if DRAFT, PENDING, or REJECTED
    // Only redirect to dashboard if APPROVED
    const verificationStatus = getEffectiveVerificationStatus(existingBusiness);
    if (verificationStatus === "APPROVED") {
      redirect("/business/dashboard");
    }
    // Otherwise, allow editing (DRAFT, PENDING, REJECTED can edit and resubmit)
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
          {isEditing ? "Редактировать профиль бизнеса" : "Welcome to Business Cabinet"}
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

          {isEditing && verificationStatus === "PENDING" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h2 className="text-lg font-semibold text-yellow-900 mb-2">
                Заявка на проверке
              </h2>
              <p className="text-yellow-700 text-sm">
                Вы можете редактировать данные, но потребуется повторная отправка на проверку.
              </p>
            </div>
          )}

          {!isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">
                Create Your Business
              </h2>
              <p className="text-blue-700 text-sm">
                Let's start by creating your business profile. You'll be able to add 
                places and offers after this step.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Current User
            </h3>
            <div className="bg-gray-50 rounded-md p-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Email:</span>{" "}
                <span className="text-gray-900">{user.email}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Role:</span>{" "}
                <span className="text-gray-900">{user.role}</span>
              </div>
            </div>
          </div>

          <OnboardingForm initialData={existingBusiness} />
        </div>
      </div>
    </div>
  );
}
