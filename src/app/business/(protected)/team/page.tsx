import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { isBusinessOwnerForInvites } from "@/server/business/businessInvite.service";
import { BusinessTeamPageClient } from "@/components/business/team/BusinessTeamPageClient";

export const metadata = {
  title: "Команда | Кабинет партнёра",
};

/**
 * Команда бизнеса: участники, приглашения, форма приглашения (только владелец).
 * Route: /business/team — один бизнес на пользователя (MVP), без [businessSlug].
 */
export default async function BusinessTeamPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    redirect("/business/onboarding");
  }

  const isOwner = await isBusinessOwnerForInvites(user.id, business.id);

  return (
    <BusinessTeamPageClient
      businessId={business.id}
      isOwner={isOwner}
    />
  );
}
