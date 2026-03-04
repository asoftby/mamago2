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
    <div>
      <h1 className="text-2xl font-bold mb-6">Контрагенты</h1>
      <p className="text-gray-600 mb-6">
        Список верифицированных бизнесов
      </p>
      <PartnersTable businesses={businesses} />
    </div>
  );
}
