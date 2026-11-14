import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";

// Lightweight navigation for the CRM workspace. Billing, support and commercial
// screens remain canonical — CRM opens those tools rather than duplicating writes.
const sections = [
  { label: "Сегодня", href: adminPath("/work") },
  { label: "Клиенты", href: adminPath("/work/clients") },
  { label: "Продажи", href: adminPath("/commercial") },
  { label: "Поддержка", href: adminPath("/support") },
  { label: "Оплаты", href: adminPath("/billing") },
  { label: "Аналитика", href: adminPath("/analytics") },
];

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Разделы CRM" className="border-b border-gray-200 bg-white px-4 sm:px-6 xl:px-8">
        <div className="flex gap-1 overflow-x-auto py-2">
          {sections.map((section) => (
            <Link
              key={section.label}
              href={section.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              {section.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
