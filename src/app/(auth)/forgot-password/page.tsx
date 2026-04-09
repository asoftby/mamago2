import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PageCloseButton } from "@/components/ui/page-close-button";

export const metadata = {
  title: "Восстановление пароля — mamaGo",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <PageCloseButton href="/login" />
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Восстановление пароля</h1>
          <p className="text-sm text-neutral-500">Введите email, и мы пришлём инструкцию для восстановления пароля.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
