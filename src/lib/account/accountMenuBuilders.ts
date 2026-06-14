import {
  CalendarDays,
  CalendarCheck,
  Lightbulb,
  Map,
  Settings,
  Shield,
  UserCircle,
} from "lucide-react";
import type { AccountMenuUser } from "@/lib/account/types";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import type { AccountMode } from "@/contexts/AccountModeContext";
import type { AccountMenuRow } from "@/components/account/types";
import type { AccountDropdownModel } from "@/components/account/AccountDropdown.types";

const isAdminRole = (role: string) => role === "ADMIN" || role === "MODERATOR";

/**
 * Публичный сайт + личный кабинет /me: меню в шапке (режим personal или business).
 */
export function buildPublicSiteAccountModel(input: {
  user: AccountMenuUser;
  mode: AccountMode;
  initials: string;
  onNavigate: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onSwitchMode: (next: AccountMode) => void;
  onGoToHome: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalBookings: () => void;
  onGoToPersonalRoutes: () => void;
  onGoToSettings: () => void;
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
    onGoToAdminAccount,
    onSwitchMode,
    onGoToPersonalAccount,
    onGoToPersonalIdeas,
    onGoToPersonalPlan,
    onGoToPersonalBookings,
    onGoToPersonalRoutes,
    onGoToSettings,
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
        key: "account",
        type: "button",
        label: "Личный аккаунт",
        icon: UserCircle,
        onClick: () => {
          onGoToPersonalAccount();
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
        key: "bookings",
        type: "button",
        label: "Мои записи",
        icon: CalendarCheck,
        onClick: () => {
          onGoToPersonalBookings();
        },
      },
      {
        key: "routes",
        type: "button",
        label: "Мои маршруты",
        icon: Map,
        onClick: () => {
          onGoToPersonalRoutes();
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
        : user.businessVerificationStatus === "PENDING"
          ? {
              variant: "pending" as const,
              title: "Ваша заявка на проверке",
            }
          : {
              variant: "connect" as const,
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

  // business mode
  return {
    sheetTitle: "Бизнес-аккаунт",
    header,
    mainItems: [],
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
 * Админка: переключатель режимов (Личный / Админ / Бизнес) + выход (form POST).
 */
export function buildAdminAccountModel(input: {
  userEmail: string;
  userDisplayName?: string | null;
  initials: string;
  goToPersonalAccount: () => void;
  goToAdminHome: () => void;
  goToBusinessAccount?: () => void;
  hasBusinessProfile?: boolean;
  businessLabel?: string;
  onNavigate: () => void;
}): AccountDropdownModel {
  const {
    userEmail,
    userDisplayName,
    initials,
    goToPersonalAccount,
    goToAdminHome,
    goToBusinessAccount,
    hasBusinessProfile = false,
    businessLabel = "MamaGo",
    onNavigate,
  } = input;

  const emailPrefix = userEmail.split("@")[0] ?? userEmail;
  const displayName = userDisplayName?.trim() || emailPrefix;

  // Если у админа есть бизнес-профиль, используем полный переключатель с тремя режимами
  if (hasBusinessProfile && goToBusinessAccount) {
    return {
      sheetTitle: "Мой аккаунт",
      header: {
        email: userEmail,
        displayName,
        initials,
        roleLabel: "Администратор",
        avatarUrl: null,
      },
      mainItems: [],
      mode: "personal", // Текущий режим определяется в AdminHeader
      onSwitchMode: (next) => {
        if (next === "personal") {
          goToPersonalAccount();
        } else if (next === "business") {
          goToBusinessAccount();
        }
      },
      businessModeAvailable: true,
      businessLabel,
      contextItems: [
        {
          key: "admin",
          type: "button",
          icon: Shield,
          label: "Админ-панель",
          variant: "default",
          onClick: goToAdminHome,
        },
      ],
      logoutMode: "form",
      loggingOut: false,
      onNavigate,
    };
  }

  // Для админов без бизнес-профиля - упрощённый переключатель
  return {
    sheetTitle: "Мой аккаунт",
    header: {
      email: userEmail,
      displayName,
      initials,
      roleLabel: "Администратор",
      avatarUrl: null,
    },
    mainItems: [],
    adminPersonalSwitcher: {
      onGoPersonal: goToPersonalAccount,
      onGoAdmin: goToAdminHome,
    },
    logoutMode: "form",
    loggingOut: false,
    onNavigate,
  };
}

/**
 * Business surface: меню в шапке бизнес-кабинета.
 * Тонкая обёртка над buildPublicSiteAccountModel с mode="business" —
 * сохраняет текущее поведение, но даёт явную точку входа для business surface.
 */
export function buildBusinessAccountModel(input: {
  user: AccountMenuUser;
  initials: string;
  onNavigate: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onSwitchMode: (next: AccountMode) => void;
  onGoToHome: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalBookings: () => void;
  onGoToPersonalRoutes: () => void;
  onGoToSettings: () => void;
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
  return buildPublicSiteAccountModel({ ...input, mode: "business" });
}
