import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; from?: string; next?: string }>;
}) {
  // Check if already authenticated
  const user = await getCurrentUser();
  if (user && user.role === "USER") {
    redirect("/me/plan");
  }

  const params = await searchParams;
  const showResetSuccess = params?.reset === "success";
  const from = params?.from;
  const next = params?.next;
  const isBusiness = from === "business";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h2 className="text-center text-3xl font-bold text-gray-900">
              {isBusiness ? "Вход в бизнес-кабинет" : "Вход"}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {isBusiness
                ? "Войдите, чтобы управлять вашим бизнесом в mamaGo"
                : "Войдите в свой аккаунт"}
            </p>
          </div>

          {showResetSuccess && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-800">
                ✓ Пароль успешно изменен. Войдите с новым паролем.
              </p>
            </div>
          )}

          <LoginForm from={from} next={next} />

          <div className="mt-6 space-y-3">
            <div className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-primary hover:underline font-medium transition-colors"
              >
                Забыли пароль?
              </Link>
            </div>
            <div className="text-center text-sm">
              <span className="text-gray-600">Нет аккаунта? </span>
              <Link
                href={`/register${from === "business" ? "?from=business" : ""}`}
                className="text-primary hover:underline font-medium transition-colors"
              >
                {isBusiness ? "Создать" : "Зарегистрироваться"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
