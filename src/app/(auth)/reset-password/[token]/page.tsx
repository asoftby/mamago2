import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="relative min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Новый пароль</h1>
          <p className="text-sm text-neutral-500">Введите новый пароль для вашего аккаунта.</p>
        </div>
        
          <ResetPasswordForm token={params.token} />
        
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Вернуться к входу
          </Link>
        </div>
      </div>
    </div>
  );
}
