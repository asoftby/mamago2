import {
  CalendarDays,
  Lightbulb,
  Bell,
  User,
  Settings,
  Shield,
  UserCircle,
} from "lucide-react";
import type { AccountMenuUser } from "@/lib/account/types";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import type { AccountMode } from "@/contexts/AccountModeContext";
import type { AccountMenuRow } from "@/components/account/types";
import type { AccountDropdownModel } from "@/components/account/AccountDropdown.types";

const isAdminRole = (role: string) =>
  role === "ADMIN" || role === "MODERATOR";

/**
 * Публичный сайт + личный кабинет /me: меню в шапке (режим personal или business).
 */
export function buildPublicSiteAccountModel(input: {
  user: AccountMenuUser;
  mode: AccountMode;
  initials: string;
  onNavigate: () => void;
  onGoToSettings: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onSwitchMode: (next: AccountMode) => void;
  onGoToHome: () => void;
  onGoToPersonalProfile: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalNotifications: () => void;
  onGoToBusinessDashboard: () => void;
  onGoToBusinessRoot: () => void;
  onGoToBusinessPublications: () => void;
  onGoToBusinessBookings: () => void;
  onGoToBusinessClients: () => void;
  onGoToBusinessAnalytics: () => void;
  onGoToBusinessPromotion: () => void;
  onGoToBusinessBilling: () => void;
  hasBusinessProfile: boolean;
  businessBalanceBYN?: number;
  onLogout: () => void | Promise<void>;
  loggingOut: boolean;
}): AccountDropdownModel {
  const {
    user,
    mode,
    initials,
    onNavigate,
    onGoToSettings,
    onGoToAdminAccount,
    onSwitchMode,
    onGoToPersonalProfile,
    onGoToPersonalIdeas,
    onGoToPersonalPlan,
    onGoToPersonalNotifications,
    onGoToBusinessBilling,
    onGoToBusinessAccount,
    hasBusinessProfile,
    businessBalanceBYN,
    onLogout,
    loggingOut,
  } = input;

  const emailPrefix = user.email?.split("@")[0] ?? user.email ?? "";
  const displayName = user.displayName?.trim() || emailPrefix;

  const roleRu = mapFamilyRoleToLabel(user.familyRole ?? undefined);
  const personaSubtitle = roleRu || null;

  const header = {
    email: user.email,
    displayName,
    initials,
    roleLabel: null as string | null,
    avatarUrl: user.avatarUrl ?? null,
    personaSubtitle,
  };

  if (mode === "personal") {
    const mainItems: AccountMenuRow[] = [
      {
        key: "profile",
        type: "button",
        label: "Профиль",
        icon: UserCircle,
        onClick: () => {
          onGoToPersonalProfile();
        },
      },
      {
        key: "ideas",
        type: "button",
        label: "Мои идеи",
        icon: Lightbulb,
        onClick: () => {
          onGoToPersonalIdeas();
        },
      },
      {
        key: "plan",
        type: "button",
        label: "Мой план",
        icon: CalendarDays,
        onClick: () => {
          onGoToPersonalPlan();
        },
      },
      {
        key: "notifications",
        type: "button",
        label: "Уведомления",
        icon: Bell,
        onClick: () => {
          onGoToPersonalNotifications();
        },
      },
      {
        key: "settings",
        type: "button",
        label: "Настройки",
        icon: Settings,
        onClick: () => {
          onGoToSettings();
        },
      },
    ];

    const contextItems: AccountMenuRow[] | undefined = isAdminRole(user.role)
      ? [
          {
            key: "admin",
            type: "button",
            label: "Перейти в админ-панель",
            icon: Shield,
            variant: "accent",
            onClick: () => {
              onGoToAdminAccount();
            },
          },
        ]
      : undefined;

    return {
      header,
      mainItems,
      contextItems,
      mode,
      onSwitchMode,
      businessModeAvailable: hasBusinessProfile,
      businessLabel: "MamaGo",
      ctaBlock: hasBusinessProfile
        ? undefined
        : {
            title: "Нужен бизнес-профиль?",
            actionLabel: "Подключить бизнес",
            onAction: () => {
              onGoToBusinessAccount();
            },
          },
      onLogout,
      logoutMode: "fetch",
      loggingOut,
      onNavigate,
    };
  }

  return {
    sheetTitle: "Бизнес-аккаунт",
    header,
    mainItems: [
      {
        key: "business-settings-help",
        type: "button",
        label: "Аккаунт и настройки",
        icon: Settings,
        onClick: () => {
          onGoToSettings();
        },
      },
    ],
    contextItems: isAdminRole(user.role)
      ? [
          {
            key: "admin",
            type: "button",
            label: "Перейти в админ-панель",
            icon: Shield,
            variant: "accent",
            onClick: () => {
              onGoToAdminAccount();
            },
          },
        ]
      : undefined,
    mode,
    onSwitchMode,
    businessModeAvailable: true,
    businessLabel: "MamaGo",
    businessBalanceBYN,
    onTopUpBalance: () => {
      onGoToBusinessBilling();
    },
    onLogout,
    logoutMode: "fetch",
    loggingOut,
    onNavigate,
  };
}

/**
 * Админка: профиль, настройки, переход в личный кабинет, выход (form).
 */
export function buildAdminAccountModel(input: {
  userEmail: string;
  initials: string;
  goToAdminSettings: () => void;
  goToProfile: () => void;
  goToPersonalAccount: () => void;
  onNavigate: () => void;
}): AccountDropdownModel {
  const {
    userEmail,
    initials,
    goToAdminSettings,
    goToProfile,
    goToPersonalAccount,
    onNavigate,
  } = input;

  return {
    sheetTitle: "Профиль",
    header: {
      email: userEmail,
      displayName: userEmail.split("@")[0] ?? userEmail,
      initials,
      roleLabel: "Администратор",
      avatarUrl: null,
    },
    mainItems: [
      {
        key: "profile",
        type: "button",
        label: "Профиль",
        icon: UserCircle,
        onClick: () => {
          goToProfile();
        },
      },
      {
        key: "settings",
        type: "button",
        label: "Настройки",
        icon: Settings,
        onClick: () => {
          goToAdminSettings();
        },
      },
    ],
    contextItems: [
      {
        key: "to-personal",
        type: "button",
        label: "Перейти в личный аккаунт",
        icon: User,
        variant: "accent",
        onClick: () => {
          goToPersonalAccount();
        },
      },
    ],
    logoutMode: "form",
    loggingOut: false,
    onNavigate,
  };
}
