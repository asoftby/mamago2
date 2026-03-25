import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";

interface SeoSectionHeaderProps {
  title: string;
  subtitle?: string;
}

/** @deprecated Используйте `SeoPageHeader` из `primitives` */
export function SeoSectionHeader({ title, subtitle }: SeoSectionHeaderProps) {
  return (
    <SeoPageHeader
      title={title}
      subtitle={subtitle}
      className="border-b-0 pb-0"
    />
  );
}
