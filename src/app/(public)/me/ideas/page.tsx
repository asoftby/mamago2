import { redirect } from "next/navigation";

export default function IdeasPage() {
  // Redirect to main cabinet for now
  redirect("/me");
}
