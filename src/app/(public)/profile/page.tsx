import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { ProfilePage } from "./ProfilePage";

export default async function ProfilePageRoute() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // For business owners, get business status
  let businessStatus: "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "NEEDS_INFO" | null = null;
  if (user.role === "BUSINESS_OWNER") {
    const business = await getMyBusiness(user.id);
    businessStatus = business?.verificationStatus || null;
  }

  return (
    <ProfilePage 
      user={user} 
      businessStatus={businessStatus}
    />
  );
}