import "server-only";
import { Resend } from "resend";

let resend: Resend | null = null;

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY не задан. Добавьте ключ Resend в окружение.");
  }
  if (!resend) {
    resend = new Resend(key);
  }
  return resend;
}
