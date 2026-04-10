"use client";

import type { ReactNode } from "react";
import { User } from "lucide-react";
import { DemoSection } from "../_components/DemoSection";
import { ComponentMetaCard } from "@/components/ui-lab/ComponentMetaCard";
import { AccountDropdownContent } from "@/components/account/AccountDropdownContent";
import type { AccountDropdownContentProps } from "@/components/account/AccountDropdownContent";
import type { AccountDropdownModel } from "@/components/account/AccountDropdown.types";
import { ACCOUNT_DROPDOWN_WIDTH_CLASS } from "@/components/account/accountDropdownTokens";
import {
  accountDropdownRowAccent,
  accountDropdownRowDefault,
  accountDropdownIconClass,
} from "@/components/account/accountDropdownTokens";
import { cn } from "@/lib/utils";
import {
  buildAdminAccountModel,
  buildPublicSiteAccountModel,
} from "@/lib/account/accountMenuBuilders";

function pickContent(model: AccountDropdownModel): AccountDropdownContentProps {
  const { sheetTitle, ...content } = model;
  void sheetTitle;
  return content;
}

function DropdownChrome({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-gray-200 bg-white shadow-md",
        ACCOUNT_DROPDOWN_WIDTH_CLASS,
      )}
    >
      {children}
    </div>
  );
}

const noop = () => {};

export function AccountDropdownSection() {
  const personalUser = buildPublicSiteAccountModel({
    user: { id: "lab", email: "parent@example.com", role: "USER" },
    mode: "personal",
    initials: "ПР",
    onNavigate: noop,
    onGoToAdminAccount: noop,
    onGoToBusinessAccount: noop,
    onGoToPersonalAccount: noop,
    onGoToPersonalProfile: noop,
    onGoToPersonalPlan: noop,
    onGoToBusinessDashboard: noop,
    onGoToBusinessPlaces: noop,
    onGoToBusinessCommercial: noop,
    onLogout: noop,
    loggingOut: false,
  });

  const personalAdmin = buildPublicSiteAccountModel({
    user: { id: "lab", email: "admin@example.com", role: "ADMIN" },
    mode: "personal",
    initials: "АД",
    onNavigate: noop,
    onGoToAdminAccount: noop,
    onGoToBusinessAccount: noop,
    onGoToPersonalAccount: noop,
    onGoToPersonalProfile: noop,
    onGoToPersonalPlan: noop,
    onGoToBusinessDashboard: noop,
    onGoToBusinessPlaces: noop,
    onGoToBusinessCommercial: noop,
    onLogout: noop,
    loggingOut: false,
  });

  const business = buildPublicSiteAccountModel({
    user: { id: "lab", email: "biz@example.com", role: "USER" },
    mode: "business",
    initials: "БИ",
    onNavigate: noop,
    onGoToAdminAccount: noop,
    onGoToBusinessAccount: noop,
    onGoToPersonalAccount: noop,
    onGoToPersonalProfile: noop,
    onGoToPersonalPlan: noop,
    onGoToBusinessDashboard: noop,
    onGoToBusinessPlaces: noop,
    onGoToBusinessCommercial: noop,
    onLogout: noop,
    loggingOut: false,
  });

  const adminApp = buildAdminAccountModel({
    userEmail: "admin@example.com",
    initials: "АД",
    goToAdminSettings: noop,
    goToProfile: noop,
    goToPersonalAccount: noop,
    onNavigate: noop,
  });

  return (
    <DemoSection
      id="account-dropdown"
      title="Account dropdown"
      description={
        "Единый паттерн меню аккаунта: белая карточка, шапка с аватаром, группы с разделителями, акцентный контекстный переход (primary), выход в том же визуальном стиле, что и остальные пункты. Конфигурация через buildPublicSiteAccountModel / buildAdminAccountModel (роль и контекст приложения: public /me, business, admin)."
      }
    >
      <ComponentMetaCard
        title="AccountDropdown + AccountDropdownContent"
        sourcePath="src/components/account/AccountDropdown.tsx"
        status="rendered"
        usedIn={[
          "src/components/site/header/ProfileDropdown.tsx",
          "src/components/site/header/HeaderAccountMenu.tsx",
          "src/components/mobile/MobileProfileSheet.tsx",
          "src/components/business/layout/BusinessHeader.tsx",
          "src/components/admin/AdminHeader.tsx",
        ]}
        description="Продакшен-меню не дублирует вёрстку: модель собирается в lib/account/accountMenuBuilders.ts."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">
              Личный кабинет (public /me), без роли админа
            </h4>
            <p className="text-xs text-muted-foreground">
              Основной блок — ссылки в /me; контекст — «Перейти в Бизнес-аккаунт».
            </p>
            <DropdownChrome>
              <AccountDropdownContent {...pickContent(personalUser)} />
            </DropdownChrome>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">
              Личный кабинет, админ на публичном сайте
            </h4>
            <p className="text-xs text-muted-foreground">
              «Админ панель» в контекстной группе с акцентным стилем (как «Перейти в личный
              аккаунт» в админке); «Перейти в Бизнес-аккаунт» для администраторов скрыт.
            </p>
            <DropdownChrome>
              <AccountDropdownContent {...pickContent(personalAdmin)} />
            </DropdownChrome>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Бизнес-аккаунт</h4>
            <p className="text-xs text-muted-foreground">
              Другой набор ссылок; акцент — «Перейти в Личный аккаунт».
            </p>
            <DropdownChrome>
              <AccountDropdownContent {...pickContent(business)} />
            </DropdownChrome>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Админка (admin)</h4>
            <p className="text-xs text-muted-foreground">
              Профиль и настройки; акцент — «Перейти в личный аккаунт»; выход через POST
              (form), в демо ниже для статики используется та же вёрстка.
            </p>
            <DropdownChrome>
              <AccountDropdownContent {...pickContent(adminApp)} />
            </DropdownChrome>
          </div>
        </div>

        <div className="mt-10 space-y-3 border-t border-border/40 pt-8">
          <h4 className="text-sm font-semibold text-gray-900">Состояния строки (токены)</h4>
          <p className="text-xs text-muted-foreground">
            default — основные пункты и «Выйти»; accent — контекстный переход (бизнес / личный
            кабинет).
          </p>
          <div
            className={cn(
              "overflow-hidden rounded-md border border-gray-200 bg-white p-2 shadow-sm",
              ACCOUNT_DROPDOWN_WIDTH_CLASS,
            )}
          >
            <button type="button" className={accountDropdownRowDefault}>
              <User className={accountDropdownIconClass} aria-hidden />
              Обычный пункт
            </button>
            <button type="button" className={accountDropdownRowAccent}>
              <User className={accountDropdownIconClass} aria-hidden />
              Акцентный переход
            </button>
          </div>
        </div>
      </ComponentMetaCard>
    </DemoSection>
  );
}
