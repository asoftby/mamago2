import { Lock, Mail, Smartphone } from "lucide-react";
import { SettingsLinkRow } from "@/components/settings/SettingsLinkRow";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import { requireSettingsContext } from "@/lib/settings/resolveSettingsContext";

export const metadata = { title: "Безопасность | mamaGo" };

export default async function SettingsSecurityPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const context = await requireSettingsContext({ requestedScope: "USER" });
  const resolvedSearchParams = (await searchParams) ?? {};
  const fromBusiness = resolvedSearchParams.from === "business";
  const iconTone = fromBusiness ? "business" : "neutral";

  return (
    <SettingsScaffold context={context} title="Безопасность">
      <div className="space-y-4">
        {fromBusiness ? (
          <SettingsLinkRow
            href="/business/settings"
            icon={Lock}
            label="Назад к бизнесу"
            description="Вернуться в настройки бизнеса"
            iconTone="business"
          />
        ) : null}
        <section>
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm divide-y divide-neutral-100">
            <SettingsLinkRow
              href="/settings/email"
              icon={Mail}
              label="Email"
              description={context.viewer.email}
              iconTone={iconTone}
            />
            <SettingsLinkRow
              href="/settings/password"
              icon={Lock}
              label="Пароль"
              description="Сменить пароль"
              iconTone={iconTone}
            />
            <SettingsLinkRow
              href="/settings/phone"
              icon={Smartphone}
              label="Телефон"
              description={context.viewer.phoneE164 ?? "Не указан"}
              iconTone={iconTone}
            />
          </div>
        </section>
      </div>
    </SettingsScaffold>
  );
}
