import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSectionTabs } from "@/components/admin/AdminSectionTabs";
import { DIRECT_SECTION_NAV_CONFIG } from "@/lib/admin/directSectionNavConfig";

export default function AdminDirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="p-6 pb-0 md:p-4 md:pb-0">
        <AdminPageHeader
          title="Direct"
          subtitle="Операционный центр переписки клиентов и бизнесов: диалоги, поводы обращения, жалобы и модерация."
          showBackButton
          backHref="/admin/communications"
        />
      </div>
      <AdminSectionTabs config={DIRECT_SECTION_NAV_CONFIG} />
      <div className="p-6 pt-0 md:p-4 md:pt-0">{children}</div>
    </div>
  );
}
