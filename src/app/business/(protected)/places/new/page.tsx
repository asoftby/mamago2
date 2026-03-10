/**
 * Create new Place - unified wizard
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";

export default async function NewPlacePage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  return <PlaceWizard mode="create" userId={user.id} />;
}
