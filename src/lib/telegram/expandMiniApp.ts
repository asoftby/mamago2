/**
 * Telegram may initially display a web_app button as a half-height sheet.
 * Expand to the maximum available height, without requesting immersive
 * fullscreen (which removes Telegram's familiar navigation chrome).
 *
 * An unsupported/throwing Telegram bridge must never block authentication.
 */
export function expandMiniApp(webApp: { expand?: () => void } | null | undefined): void {
  try {
    webApp?.expand?.();
  } catch {
    // The host controls viewport support; continue signing in normally.
  }
}
