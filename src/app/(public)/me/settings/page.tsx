import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { Container } from "@/components/ui/Container";
import Link from "next/link";
import type React from "react";
import { ChevronLeft, ChevronRight, Bell, Lock, User } from "lucide-react";
import { SettingsDeleteRow } from "./SettingsDeleteRow";
import { EmailVerificationSettingsRow } from "@/features/email-verification/components/EmailVerificationSettingsRow";

export const metadata = { title: "Настройки | mamaGo" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sections: {
    title: string;
    items: { icon: React.ElementType; label: string; href: string; description?: string; danger?: boolean }[];
  }[] = [
    {
      title: "Профиль",
      items: [
        { icon: User, label: "Имя и аватар", href: "/me/settings/profile", description: "Обновите имя и фото" },
      ],
    },
    {
      title: "Уведомления",
      items: [
        {
          icon: Bell,
          label: "Каналы уведомлений",
          href: "/me/settings/notifications",
          description: "Полная страница; быстрые настройки — в окне по иконке колокольчика",
        },
      ],
    },
  ];

  const securityItems: {
    icon: React.ElementType;
    label: string;
    href: string;
    description?: string;
  }[] = [
    { icon: Lock, label: "Пароль", href: "/forgot-password", description: "Сменить пароль" },
    { icon: Lock, label: "Телефон", href: "/me/settings/security", description: user.phoneE164 ?? "Не привязан" },
  ];

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-2xl">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/me"
              className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 transition-colors shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold text-neutral-900">Настройки</h1>
          </div>

          {sections.map((section) => (
            <section key={section.title}>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-1 mb-2">
                {section.title}
              </p>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-100">
                {section.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-neutral-100">
                      <item.icon className="h-4 w-4 text-neutral-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">{item.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-1 mb-2">
              Безопасность
            </p>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-100">
              <EmailVerificationSettingsRow />
              {securityItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-neutral-100">
                    <item.icon className="h-4 w-4 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">{item.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </section>

          {/* Danger zone */}
          <section>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider px-1 mb-2">
              Конфиденциальность
            </p>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <SettingsDeleteRow />
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
