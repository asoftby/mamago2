import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { OnboardingForm } from "./OnboardingForm";

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
    redirect("/business/dashboard");
  }

  // 3. Render onboarding form
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome to Business Cabinet
        </h1>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Create Your Business
            </h2>
            <p className="text-blue-700 text-sm">
              Let's start by creating your business profile. You'll be able to add 
              places and offers after this step.
            </p>
          </div>

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

          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
