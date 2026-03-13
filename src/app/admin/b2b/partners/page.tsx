import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PartnersTable } from "./PartnersTable";

export default async function PartnersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect("/admin");
  }

  // Fetch approved businesses
  const businesses = await prisma.business.findMany({
    where: {
      verificationStatus: "APPROVED",
    },
    include: {
      owner: {
        select: {
          email: true,
          phoneE164: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900">Контрагенты</h1>
        <p className="text-sm text-gray-600 mt-1">
          Список верифицированных бизнесов
        </p>
      </div>
      
      {/* AdminPageContent */}
      <PartnersTable businesses={businesses} />
    </div>
  );
}
