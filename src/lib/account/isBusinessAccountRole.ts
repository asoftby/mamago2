export function isBusinessAccountRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === "BUSINESS_OWNER" || role === "BUSINESS";
}

export function resolveHasBusinessProfile(input: {
  role: string | null | undefined;
  hasApprovedBusinessProfile?: boolean | null;
}): boolean {
  if (input.hasApprovedBusinessProfile === true) return true;
  return isBusinessAccountRole(input.role);
}
