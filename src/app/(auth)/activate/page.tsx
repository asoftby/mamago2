import { Suspense } from "react";
import { ActivateForm } from "./ActivateForm";

export const metadata = {
  title: "Активация аккаунта — mamaGo",
  robots: { index: false, follow: false },
};

export default function ActivatePage() {
  return (
    <div className="relative min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <Suspense fallback={<div className="py-8 text-center text-sm text-neutral-500">Проверяем ссылку...</div>}>
          <ActivateForm />
        </Suspense>
      </div>
    </div>
  );
}
