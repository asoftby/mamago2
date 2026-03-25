/** Безопасная проверка (без instanceof по классу из другого бандла). */
export function isPrismaValidationError(e: unknown): boolean {
  return e instanceof Error && e.name === "PrismaClientValidationError";
}
