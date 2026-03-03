import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { BusinessVerificationList } from "./BusinessVerificationList";

export default async function BusinessVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect("/");
  }

  const params = await searchParams;
  const status = params.status || "PENDING";

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Проверка бизнесов</h1>
      <BusinessVerificationList initialStatus={status} />
    </div>
  );
}
