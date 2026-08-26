/**
 * Pure decision rule for the PAGE_VIEW route observer (`PageViewTracker`).
 * Kept separate from the client component so it can be unit-tested without
 * mounting React — this repo's tests run as plain tsx scripts, not RTL.
 */
export function shouldEmitPageView(
  previousPathname: string | null,
  pathname: string,
): boolean {
  return pathname !== previousPathname;
}

/**
 * Top-level route segments that live OUTSIDE the `(public)` group's layout
 * tree (`src/app/(public)/PublicLayoutBody.tsx`, the only place
 * `PageViewTracker` is mounted) — audited directly against `src/app/*`:
 *
 *   - own top-level folder + layout: admin, business, settings
 *   - own top-level folder, single page/route: account, auth, business-entry,
 *     identity, invite, n, profile-entry, u
 *   - non-page: api, actions (server actions/routes, never client-navigated
 *     to, excluded defensively per the same contract)
 *   - sibling route groups (also add no URL prefix, so their pages are
 *     genuine top-level segments too): (auth) -> login, register,
 *     forgot-password, reset-password, activate; (ui) -> ui-lab,
 *     ui-lab-admin; (content-editor) -> editor
 *
 * `/me` is deliberately NOT here — it lives inside `(public)` itself
 * (`src/app/(public)/me`) and is normally, permanently mounted under
 * `PublicLayoutBody`, not a transient pass-through, so it stays tracked.
 * `(birthday-make)` shares the public `[city]` dynamic segment and isn't
 * part of the leak's reproduction, so it's left untouched.
 */
const NON_PUBLIC_TOP_SEGMENTS = [
  "admin",
  "business",
  "business-entry",
  "account",
  "auth",
  "identity",
  "invite",
  "n",
  "profile-entry",
  "settings",
  "u",
  "api",
  "actions",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "activate",
  "ui-lab",
  "ui-lab-admin",
  "editor",
] as const;

/**
 * True when `pathname` belongs to the public site's tracked surface —
 * i.e. it is NOT one of the non-public top-level segments above. Guards
 * against a real, reproduced bug: navigating client-side from a public page
 * into a different top-level layout (e.g. `/admin/...`) can leave
 * `usePathname()` reporting the new (non-public) path for one render tick
 * before `PublicLayoutBody`/`PageViewTracker` unmount, which would
 * otherwise emit a PAGE_VIEW for a surface the tracker was never meant to
 * observe.
 */
export function isPublicPageViewPath(pathname: string): boolean {
  const firstSegment = pathname.split("/", 2)[1] ?? "";
  return !(NON_PUBLIC_TOP_SEGMENTS as readonly string[]).includes(firstSegment);
}
