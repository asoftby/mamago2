import type { LucideIcon } from "lucide-react";

/** Строка меню: ссылка или кнопка (в т.ч. акцентный контекстный переход). */
export type AccountMenuRow =
  | {
      key: string;
      type: "link";
      href: string;
      label: string;
      icon: LucideIcon;
      /** accent — как контекстные переходы (админка, бизнес и т.д.) */
      variant?: "default" | "accent";
    }
  | {
      key: string;
      type: "button";
      label: string;
      icon: LucideIcon;
      onClick: () => void;
      /** accent — контекстный переход (личный / админ и т.д.) */
      variant?: "default" | "accent";
    };

export type AccountDropdownHeaderModel = {
  email: string;
  initials: string;
  avatarUrl?: string | null;
  /** Подпись под email: роль, «Администратор» и т.д. */
  roleLabel?: string | null;
  /** Над email, напр. «Вы вошли как» — можно не передавать */
  metaCaption?: string | null;
};
