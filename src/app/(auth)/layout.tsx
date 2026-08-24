import type { Metadata } from "next";
import React from "react";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

export const metadata: Metadata = {
  robots: PERMANENT_NOINDEX_ROBOTS,
};

/**
 * Вход, регистрация, восстановление пароля — без сайтового хедера, футера и мобильной навигации.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">{children}</div>
  );
}
