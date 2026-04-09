import type {
  ProfileCompletionFlags,
  ProfileMandatoryStepId,
  ProfileStatePayload,
} from "./types";

type MinimalUser = {
  familyRole?: string | null;
  ageBandLabel?: string | null;
};

type MinimalChild = {
  id: string;
  name: string;
  birthDate: Date | string | null;
  createdAt: Date | string;
  systemInterests?: { interestSlug: string }[];
};

export function hasAdultProfile(user: MinimalUser): boolean {
  return Boolean(user.familyRole?.trim() && user.ageBandLabel?.trim());
}

/** Месяц/год из birthDate (день может быть 1-е число). */
export function childHasBirthMonthYear(child: MinimalChild): boolean {
  if (!child.birthDate) return false;
  const d = new Date(child.birthDate);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 1990 && y <= new Date().getFullYear() + 1;
}

export function childHasInterests(child: MinimalChild): boolean {
  return (child.systemInterests?.length ?? 0) >= 1;
}

function sortChildrenByCreatedAtAsc(children: MinimalChild[]): MinimalChild[] {
  return [...children].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function getPrimaryChild(children: MinimalChild[]): MinimalChild | null {
  const sorted = sortChildrenByCreatedAtAsc(children);
  return sorted[0] ?? null;
}

export function computeProfileCompletionFlags(
  user: MinimalUser,
  children: MinimalChild[],
): ProfileCompletionFlags {
  const primary = getPrimaryChild(children);
  const childProfileOk = primary != null && childHasBirthMonthYear(primary);
  const childInterestsOk =
    primary != null && childHasBirthMonthYear(primary) && childHasInterests(primary);

  return {
    hasAdultProfile: hasAdultProfile(user),
    hasChildProfile: childProfileOk,
    hasChildInterests: childInterestsOk,
    isProfileComplete:
      hasAdultProfile(user) && childProfileOk && childInterestsOk,
  };
}

/** Только для незавершённого usable-профиля; иначе null. */
export function resolveResumeStep(
  user: MinimalUser,
  children: MinimalChild[],
): ProfileMandatoryStepId | null {
  if (!hasAdultProfile(user)) return "adult";
  const primary = getPrimaryChild(children);
  if (!primary || !childHasBirthMonthYear(primary)) return "child";
  if (!childHasInterests(primary)) return "child_interests";
  return null;
}

export function buildProfileStatePayload(
  user: { id: string; familyRole?: string | null; ageBandLabel?: string | null },
  children: MinimalChild[],
): ProfileStatePayload {
  const flags = computeProfileCompletionFlags(user, children);
  const primary = getPrimaryChild(children);
  const resumeStep = resolveResumeStep(user, children);

  return {
    ...flags,
    primaryChildId: primary?.id ?? null,
    resumeStep,
    user: {
      id: user.id,
      familyRole: user.familyRole ?? null,
      ageBandLabel: user.ageBandLabel ?? null,
    },
    children: sortChildrenByCreatedAtAsc(children).map((c) => ({
      id: c.id,
      name: c.name,
      birthDate: c.birthDate
        ? typeof c.birthDate === "string"
          ? c.birthDate
          : c.birthDate.toISOString()
        : null,
      createdAt:
        typeof c.createdAt === "string" ? c.createdAt : c.createdAt.toISOString(),
      interestCount: c.systemInterests?.length ?? 0,
    })),
  };
}
