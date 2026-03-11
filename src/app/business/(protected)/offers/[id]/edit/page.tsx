import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  const { id } = await params;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Редактирование предложения
          </h1>
          <p className="text-gray-600 mb-2">
            ID: {id}
          </p>
          <p className="text-gray-600 mb-6">
            Форма редактирования предложения будет реализована на следующем этапе.
          </p>
          <a
            href="/business/offers"
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Вернуться к списку
          </a>
        </div>
      </div>
    </div>
  );
}
