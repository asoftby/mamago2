import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; intent?: string }>;
}) {
  // Await searchParams in Next.js 16
  const params = await searchParams;
  const from = params?.from;
  const intentParam = params?.intent;
  const intent = intentParam === "business" || from === "business" ? "business" : "personal";

  const content = {
    personal: {
      badge: "Новый формат семейного досуга",
      title: "Фамилинг с mamaGo",
      subtitle: "Сохраняйте идеи и создавайте семейные сценарии.",
    },
    business: {
      badge: null,
      title: "Присоединяйтесь к mamaGo",
      subtitle: "Размещайте публикации, привлекайте семьи и развивайте свой бренд.",
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-10 text-center space-y-4">
            {content[intent].badge && (
              <div className="flex justify-center">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary tracking-wide">
                  {content[intent].badge}
                </div>
              </div>
            )}
            <h1 className="text-3xl font-semibold tracking-tight">
              {content[intent].title}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              {content[intent].subtitle}
            </p>
          </div>

          <RegisterForm from={from} buttonText={intent === "business" ? "Продолжить" : "Создать аккаунт"} intent={intent} />

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Уже есть аккаунт? </span>
            <Link
              href={`/login${from === "business" ? "?from=business" : ""}`}
              className="text-primary hover:underline font-medium transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
