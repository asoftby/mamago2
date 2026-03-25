import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; intent?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/me");
  }

  const params = await searchParams;
  if (params?.from === "business" || params?.intent === "business") {
    redirect("/register");
  }

  const content = {
    badge: "Новый формат семейного досуга",
    title: "Фамилинг с mamaGo",
    subtitle: "Сохраняйте идеи и создавайте семейные сценарии.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-[420px] space-y-8">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="mb-10 space-y-4 text-center">
            {content.badge && (
              <div className="flex justify-center">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary">
                  {content.badge}
                </div>
              </div>
            )}
            <h1 className="text-3xl font-semibold tracking-tight">{content.title}</h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              {content.subtitle}
            </p>
          </div>

          <RegisterForm buttonText="Создать аккаунт" />

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Уже есть аккаунт? </span>
            <Link
              href="/login"
              className="font-medium text-primary transition-colors hover:underline"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
