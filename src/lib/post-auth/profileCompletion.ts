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
  name: string | null;
  birthDate: Date | string | null;
  birthPrecision?: "DAY" | "MONTH" | null;
  createdAt: Date | string;
  systemInterests?: { interestSlug: string }[];
};

/**
 * Informational only — family role is an optional profile attribute (B1) and
 * never gates completion. Adult age/DOB is not collected at all.
 */
export function hasAdultProfile(user: MinimalUser): boolean {
  return Boolean(user.familyRole?.trim());
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

/**
 * B1: adult profile (role/age) and child interests are no longer mandatory —
 * only a usable child birth month/year gates "complete". Adult age is never
 * collected; family role is optional and tracked only informationally.
 */
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
    isProfileComplete: childProfileOk,
  };
}

/**
 * Only for a not-yet-usable profile; otherwise null. The optional adult/role
 * prompt is offered once, only to a brand-new profile with no children yet —
 * it never blocks and is never forced on a return visit. Interests are
 * optional (B1) and no longer produce a resume step.
 */
export function resolveResumeStep(
  user: MinimalUser,
  children: MinimalChild[],
): ProfileMandatoryStepId | null {
  const primary = getPrimaryChild(children);
  if (primary && childHasBirthMonthYear(primary)) return null;
  if (children.length === 0) return "adult";
  return "child";
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
      birthPrecision: c.birthPrecision ?? null,
      createdAt:
        typeof c.createdAt === "string" ? c.createdAt : c.createdAt.toISOString(),
      interestCount: c.systemInterests?.length ?? 0,
    })),
  };
}
