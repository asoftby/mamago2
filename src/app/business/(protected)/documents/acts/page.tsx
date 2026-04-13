import { BusinessPlaceholderPage } from "@/components/business/sections/BusinessPlaceholderPage";
import {
  BUSINESS_BILLING_PLAN_HREF,
  BUSINESS_CONTRACTS_HREF,
} from "@/lib/business/navigation";

export default function BusinessActsPage() {
  return (
    <BusinessPlaceholderPage
      eyebrow="Documents"
      title="Acts"
      description="Акты будут доступны в отдельной юридической зоне кабинета, рядом с договорами, но не внутри финансовых настроек."
      summary="Для бизнеса это важная часть доверия: документы должны быть предсказуемо расположены и не теряться среди тарифов, пополнений и рекламных настроек."
      nextActionLabel="Открыть Contracts"
      nextActionHref={BUSINESS_CONTRACTS_HREF}
      bullets={[
        "Акты можно будет просматривать и скачивать в одном месте.",
        "Если в будущем появятся статусы подписи или сверки, у этого раздела уже есть правильный дом.",
        "Billing остаётся про деньги и операции, Documents — про юридические артефакты.",
      ]}
      secondaryLinks={[{ label: "Billing", href: BUSINESS_BILLING_PLAN_HREF }]}
    />
  );
}
