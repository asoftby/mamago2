import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Foundation route — not a user product until Content Plan persistence. */
export default function AdminSeoContentRedirectPage() {
  redirect(buildAdminPath("/seo"));
}
