export function isConfirmationDeadlock(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const prismaError = error as Error & { code?: string; meta?: { code?: string } };
  return prismaError.code === "P2034" || prismaError.code === "40P01" ||
    prismaError.meta?.code === "40P01" || /\b40P01\b/.test(error.message);
}
