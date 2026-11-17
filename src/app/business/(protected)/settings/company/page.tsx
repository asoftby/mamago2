import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { OnboardingForm } from "@/app/business/onboarding/OnboardingForm";
import { CompanyRequisitesForm } from "@/components/business/CompanyRequisitesForm";
export default async function BusinessCompanySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");
  const isOwner = business.ownerUserId === user.id;
  const labels: Record<string, string> = { COMPANY: "Юридическое лицо", SOLE_PROPRIETOR: "ИП", SELF_EMPLOYED_NPD: "Самозанятый (НПД)", UNSPECIFIED: "Не уточнена" };
  return <div className="space-y-6"><h1 className="text-2xl font-semibold">Компания</h1>
    <section className="space-y-3 rounded-xl border border-border bg-surface p-5"><h2 className="text-lg font-medium">Регистрационные данные</h2>
      <p>Форма деятельности: {labels[business.subjectType]}</p><p>Публичное название: {business.name}</p>
      <p>УНП: {business.unp || "не указан"}</p><p>Юридическое название / ФИО: {business.registrationFullName || business.legalName || "не указано"}</p>
      <p>Модерация mamaGo: {business.verificationStatus}</p>
      <p>Государственная проверка: {business.subjectType === "SELF_EMPLOYED_NPD" ? business.npdCheckStatus : business.unpVerificationStatus}</p>
      {(business.npdCheckedAt || business.unpLastCheckedAt) && <p>Дата проверки: {(business.npdCheckedAt || business.unpLastCheckedAt)?.toLocaleString("ru-RU")}</p>}
      <p className="text-sm text-muted-foreground">Регистрационные данные защищены от обычного редактирования.</p>
      {isOwner && business.verificationStatus === "APPROVED" && <details><summary className="cursor-pointer text-primary">Запросить изменение регистрационных данных</summary>
        <p className="my-4 text-sm">Отправка изменённых данных приостановит допуск к публикации до повторного решения модератора. Прежние финансовые документы не изменятся.</p>
        <OnboardingForm registrationChangeMode currentUserId={user.id} initialData={{ subjectType: business.subjectType, publicName: business.name, registrationFullName: business.registrationFullName, legalName: business.legalName ?? undefined, unp: business.unp ?? undefined, phone: business.phone, contactPhoneVerifiedAt: business.contactPhoneVerifiedAt?.toISOString() }} accountPhoneE164={user.phoneE164} accountPhoneVerifiedAt={user.phoneVerifiedAt?.toISOString()} businessContactVerifiedPhoneE164={user.businessContactVerifiedPhoneE164} businessContactPhoneVerifiedAt={user.businessContactPhoneVerifiedAt?.toISOString()} />
      </details>}
    </section>{isOwner && <CompanyRequisitesForm />}</div>;
}
