import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";

export default async function BusinessEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    // User is not authenticated - go to login with from=business
    redirect("/login?from=business");
  }

  // User is authenticated - check if business exists
  const business = await getMyBusiness(user.id);
  
  if (business) {
    // Business exists - go to dashboard
    redirect("/business/dashboard");
  } else {
    // No business - go to onboarding
    redirect("/business/onboarding");
  }
}
