import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { AddChildForm } from "./AddChildForm";
import { LogoutButton } from "./LogoutButton";

export default async function ProfilePage() {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch children
  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Check if user has business
  const business = await getMyBusiness(user.id);

  // Calculate age from birthDate
  function calculateAge(birthDate: Date): string {
    const today = new Date();
    const birth = new Date(birthDate);
    const years = today.getFullYear() - birth.getFullYear();
    const months = today.getMonth() - birth.getMonth();
    
    if (years === 0) {
      return `${months} мес.`;
    } else if (months < 0) {
      return `${years - 1} лет`;
    } else {
      return `${years} лет`;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Мой профиль
            </h1>
            <LogoutButton />
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Email: </span>
              <span className="text-gray-900">{user.email}</span>
            </div>

            {business && (
              <div>
                <span className="text-sm font-medium text-gray-700">Бизнес: </span>
                <Link
                  href="/business"
                  className="text-primary hover:underline font-medium transition-colors"
                >
                  {business.name} →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Children Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Мои дети
          </h2>

          {children.length > 0 ? (
            <div className="space-y-3 mb-6">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="border border-gray-200 rounded-md p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {child.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {calculateAge(child.birthDate)} • {new Date(child.birthDate).toLocaleDateString("ru-RU")}
                      </p>
                      {child.interests && (
                        <p className="text-sm text-gray-700 mt-2">
                          <span className="font-medium">Интересы:</span> {child.interests}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 mb-6">
              У вас пока нет добавленных детей
            </p>
          )}

          {/* Add Child Form */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Добавить ребёнка
            </h3>
            <AddChildForm />
          </div>
        </div>
      </div>
    </div>
  );
}
