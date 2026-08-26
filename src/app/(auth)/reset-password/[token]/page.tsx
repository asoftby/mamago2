import Link from "next/link";
import { PageCloseButton } from "@/components/ui/page-close-button";
import { isPasswordResetTokenValid } from "@/server/auth/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Новый пароль — mamaGo",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenIsValid = await isPasswordResetTokenValid(token);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <PageCloseButton href="/login" />
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-md sm:p-8">
        {tokenIsValid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold text-neutral-900">Ссылка больше не действует</h1>
              <p className="text-sm leading-6 text-neutral-500">
                Срок действия ссылки истёк или она уже была использована. Запросите новую ссылку —
                это займёт меньше минуты.
              </p>
            </div>

            <Link
              href="/forgot-password"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Получить новую ссылку
            </Link>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              >
                Вернуться ко входу
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
