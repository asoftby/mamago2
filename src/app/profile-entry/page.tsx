import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

export default async function ProfileEntryPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/me");
  } else {
    redirect("/login");
  }
}
