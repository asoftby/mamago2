import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { SupportInbox } from "@/features/support/SupportInbox";
import { redirect } from "next/navigation";

export default async function BusinessSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business");
  return <SupportInbox businessId={business.id}/>;
}
