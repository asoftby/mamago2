/** Пользователь для меню аккаунта (API /api/auth/me и т.п.) */
export type AccountMenuUser = {
  id: string;
  email: string;
  role: string;
};

/** Контекст приложения для сборки пунктов меню */
export type AccountAppSurface =
  | "public"
  | "admin"
  | "business";
