import { redirect } from "next/navigation";

/** Historic URL; examples are preserved under the unified UI Lab admin archive. */
export default function LegacyAdminUiLabRedirect() {
  redirect("/ui-lab?tab=admin");
}
