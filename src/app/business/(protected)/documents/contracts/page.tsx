import { BusinessPlaceholderPage } from "@/components/business/sections/BusinessPlaceholderPage";
import {
  BUSINESS_ACTS_HREF,
  BUSINESS_BILLING_PLAN_HREF,
} from "@/lib/business/navigation";

export default function BusinessContractsPage() {
  return (
    <BusinessPlaceholderPage
      eyebrow="Documents"
      title="Contracts"
      description="Здесь будут храниться коммерческие договоры бизнеса и связанные с ними документы."
      summary="Документы отделены от Billing, чтобы деньги и юридические основания не смешивались в одном разделе. Это делает кабинет понятнее и повышает доверие к B2B-части продукта."
      nextActionLabel="Открыть Billing"
      nextActionHref={BUSINESS_BILLING_PLAN_HREF}
      bullets={[
        "Договоры должны быть легко доступны владельцу бизнеса и команде с нужной ролью.",
        "В дальнейшем здесь можно добавить статусы: активен, на продлении, требует подписи.",
        "Юридические документы будут жить отдельно от расходов и баланса.",
      ]}
      secondaryLinks={[{ label: "Acts", href: BUSINESS_ACTS_HREF }]}
    />
  );
}
