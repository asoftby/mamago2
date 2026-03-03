import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { BusinessVerificationDetail } from "./BusinessVerificationDetail";

export default async function BusinessVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect("/");
  }

  const { id } = await params;

  return (
    <div className="container mx-auto py-8 px-4">
      <BusinessVerificationDetail businessId={id} />
    </div>
  );
}
