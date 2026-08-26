import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PageCloseButton } from "@/components/ui/page-close-button";

export const metadata = {
  title: "Восстановление пароля — mamaGo",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <PageCloseButton href="/login" />
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-md sm:p-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
