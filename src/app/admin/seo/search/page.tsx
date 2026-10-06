import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Foundation route — not a user product until Search Intelligence. */
export default function AdminSeoSearchRedirectPage() {
  redirect(buildAdminPath("/seo"));
}
