import { redirect } from "next/navigation";

/**
 * Root business route - redirects to dashboard
 */
export default function BusinessRootPage() {
  redirect("/business/dashboard");
}
