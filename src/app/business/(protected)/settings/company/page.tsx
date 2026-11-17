import { redirect } from "next/navigation";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { OnboardingForm } from "@/app/business/onboarding/OnboardingForm";
import { CompanyRequisitesForm } from "@/components/business/CompanyRequisitesForm";

const subjectLabels: Record<string, string> = {
  COMPANY: "Юридическое лицо",
  SOLE_PROPRIETOR: "Индивидуальный предприниматель",
  SELF_EMPLOYED_NPD: "Самозанятый (НПД)",
  UNSPECIFIED: "Не уточнена",
};

const moderationLabels: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  APPROVED: "Подтверждено",
  REJECTED: "Отклонено",
  NEEDS_INFO: "Требуется уточнение",
};

const registryLabels: Record<string, string> = {
  PENDING: "Ожидает проверки",
  VERIFIED: "Данные подтверждены",
  NAME_MISMATCH: "Название не совпадает с реестром",
  INACTIVE: "Регистрация недействительна",
  NOT_FOUND: "Запись не найдена",
  LOOKUP_FAILED: "Не удалось проверить",
};

const npdLabels: Record<string, string> = {
  REVIEW_REQUIRED: "Ожидает проверки",
  CONFIRMED: "Регистрация НПД подтверждена",
  NOT_FOUND: "Регистрация НПД не найдена",
  UNAVAILABLE: "Не удалось проверить",
};

function displayStatus(value: string | null | undefined, labels: Record<string, string>) {
  return (value && labels[value]) || "Статус уточняется";
}

export default async function BusinessCompanySettingsPage() {
  const context = await requireSettingsContext({ requestedScope: "BUSINESS" });
  const user = context.viewer;
  const business = await getMyBusiness(user.id);
  if (!business) redirect("/business/onboarding");

  const isOwner = business.ownerUserId === user.id;
  const isNpd = business.subjectType === "SELF_EMPLOYED_NPD";
  const lastCheckedAt = isNpd ? business.npdCheckedAt : business.unpLastCheckedAt;

  return (
    <SettingsScaffold
      context={context}
      title="Компания"
      currentSectionId="company"
      maxWidthClassName="max-w-3xl"
    >
      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Регистрационные данные</h2>
          <p className="mt-1 text-sm text-stone-600">
            Сведения, предоставленные при регистрации бизнеса и проверке в mamaGo.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">Форма деятельности</dt>
            <dd className="font-medium text-stone-950">{displayStatus(business.subjectType, subjectLabels)}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">Публичное название</dt>
            <dd className="font-medium text-stone-950">{business.name}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">УНП</dt>
            <dd className="font-medium text-stone-950">{business.unp || "Не указан"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">{isNpd ? "ФИО" : "Юридическое название / ФИО ИП"}</dt>
            <dd className="font-medium text-stone-950">
              {business.registrationFullName || business.legalName || "Не указано"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">Проверка mamaGo</dt>
            <dd className="font-medium text-stone-950">
              {displayStatus(business.verificationStatus, moderationLabels)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-sm text-stone-500">{isNpd ? "Проверка НПД в МНС" : "Проверка государственного реестра"}</dt>
            <dd className="font-medium text-stone-950">
              {displayStatus(isNpd ? business.npdCheckStatus : business.unpVerificationStatus, isNpd ? npdLabels : registryLabels)}
            </dd>
          </div>
          {lastCheckedAt && (
            <div className="space-y-1">
              <dt className="text-sm text-stone-500">Дата последней проверки</dt>
              <dd className="font-medium text-stone-950">
                {lastCheckedAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Minsk" })}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-sm text-stone-600">
          Подтверждённые регистрационные данные защищены от обычного редактирования.
        </p>
        {isOwner && business.verificationStatus === "APPROVED" && (
          <details className="rounded-xl border border-stone-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-950">
              Запросить изменение регистрационных данных
            </summary>
            <p className="my-4 text-sm text-stone-600">
              После отправки изменённых данных потребуется повторная модерация.
              На время проверки доступ к публикации может быть ограничен.
            </p>
            <OnboardingForm
              registrationChangeMode
              currentUserId={user.id}
              initialData={{
                subjectType: business.subjectType,
                publicName: business.name,
                registrationFullName: business.registrationFullName,
                legalName: business.legalName ?? undefined,
                unp: business.unp ?? undefined,
                phone: business.phone,
                contactPhoneVerifiedAt: business.contactPhoneVerifiedAt?.toISOString(),
              }}
              accountPhoneE164={user.phoneE164}
              accountPhoneVerifiedAt={user.phoneVerifiedAt?.toISOString()}
            />
          </details>
        )}
      </section>
      {isOwner ? (
        <CompanyRequisitesForm />
      ) : (
        <p className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
          Реквизиты может изменить только владелец бизнес-аккаунта.
        </p>
      )}
    </SettingsScaffold>
  );
}
