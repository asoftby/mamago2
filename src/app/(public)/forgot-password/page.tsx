import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h2 className="text-center text-3xl font-bold text-gray-900">
              Восстановление пароля
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Введите email для получения инструкций
            </p>
          </div>

          <ForgotPasswordForm />

          <div className="mt-6 text-center text-sm">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              ← Вернуться к входу
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
