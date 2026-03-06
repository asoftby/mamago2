import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getProfileDestination } from "@/lib/routing/profileRedirect";

export default async function ProfileEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get host for subdomain routing
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";

  // For BUSINESS_OWNER, check business status
  let businessStatus: "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "NEEDS_INFO" | null = null;
  if (user.role === "BUSINESS_OWNER") {
    const business = await getMyBusiness(user.id);
    businessStatus = business?.verificationStatus || null;
  }

  // Get appropriate destination
  const destination = getProfileDestination({
    host,
    role: user.role,
    businessStatus,
  });

  redirect(destination);
}
