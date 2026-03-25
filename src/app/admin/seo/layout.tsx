import { SeoSubNav } from "@/components/admin/seo/SeoSubNav";

/**
 * Общий каркас SEO: только вторичная навигация.
 * Заголовок раздела — на странице дашборда и в подразделах.
 */
export default function SeoControlCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-4 space-y-6">
      <header className="border-b border-gray-200 pb-4">
        <SeoSubNav />
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
