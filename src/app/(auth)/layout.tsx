import React from "react";

/**
 * Вход, регистрация, восстановление пароля — без сайтового хедера, футера и мобильной навигации.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">{children}</div>
  );
}
