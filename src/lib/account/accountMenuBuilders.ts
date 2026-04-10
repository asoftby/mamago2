import {
  Briefcase,
  ClipboardList,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  User,
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
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalProfile: () => void;
  onGoToPersonalPlan: () => void;
  onGoToBusinessDashboard: () => void;
  onGoToBusinessPlaces: () => void;
  onGoToBusinessCommercial: () => void;
  onLogout: () => void | Promise<void>;
  loggingOut: boolean;
}): AccountDropdownModel {
  const {
    user,
    mode,
    initials,
    onNavigate,
    onGoToAdminAccount,
    onGoToBusinessAccount,
    onGoToPersonalAccount,
    onGoToPersonalProfile,
    onGoToPersonalPlan,
    onGoToBusinessDashboard,
    onGoToBusinessPlaces,
    onGoToBusinessCommercial,
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
        icon: User,
        onClick: () => {
          onGoToPersonalProfile();
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
    ];

    const contextItems: AccountMenuRow[] | undefined = isAdminRole(user.role)
      ? [
          {
            key: "admin",
            type: "button",
            label: "Админ панель",
            icon: Shield,
            variant: "accent",
            onClick: () => {
              onGoToAdminAccount();
            },
          },
        ]
      : [
          {
            key: "to-business",
            type: "button",
            label: "Перейти в Бизнес-аккаунт",
            icon: Briefcase,
            variant: "accent",
            onClick: () => {
              onGoToBusinessAccount();
            },
          },
        ];

    return {
      header,
      mainItems,
      contextItems,
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
        key: "dash",
        type: "button",
        label: "Дашборд",
        icon: LayoutDashboard,
        onClick: () => {
          onGoToBusinessDashboard();
        },
      },
      {
        key: "places",
        type: "button",
        label: "Мои места",
        icon: MapPin,
        onClick: () => {
          onGoToBusinessPlaces();
        },
      },
      {
        key: "commercial",
        type: "button",
        label: "Заявки и коммерция",
        icon: ClipboardList,
        onClick: () => {
          onGoToBusinessCommercial();
        },
      },
    ],
    contextItems: [
      {
        key: "to-personal",
        type: "button",
        label: "Перейти в Личный аккаунт",
        icon: User,
        variant: "accent",
        onClick: () => {
          onGoToPersonalAccount();
        },
      },
    ],
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
