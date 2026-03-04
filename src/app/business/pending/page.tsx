import { redirect } from "next/navigation";

/**
 * DEPRECATED ROUTE - Redirects to canonical verification page
 * /business/pending -> /business/verification
 * 
 * This route exists only for backward compatibility.
 * All business verification status display is now at /business/verification
 */
export default function LegacyPendingPageRedirect() {
  redirect("/business/verification");
}
