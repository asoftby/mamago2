import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { BackButton } from "./BackButton";

export const metadata = {
  title: "Восстановление пароля — mamaGo",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <BackButton />
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-neutral-900">Восстановление пароля</h1>
          <p className="text-sm text-neutral-500">Введите email — пришлём инструкции</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
