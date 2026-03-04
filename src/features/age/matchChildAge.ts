/**
 * Child Age Matching Utility
 * 
 * Used to match a child's age (in months) against activity age requirements.
 */

export interface ActivityAgeRequirement {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
}

/**
 * Check if a child's age matches an activity's age requirements
 * 
 * @param childAgeMonths - Child's age in months
 * @param activity - Activity with age requirements
 * @returns true if the child's age falls within the activity's age range
 */
export function matchChildAge(
  childAgeMonths: number,
  activity: ActivityAgeRequirement
): boolean {
  const { ageMinMonths, ageMaxMonths } = activity;

  // No age restriction
  if (ageMinMonths === null && ageMaxMonths === null) {
    return true;
  }

  // Check minimum age
  if (ageMinMonths !== null && childAgeMonths < ageMinMonths) {
    return false;
  }

  // Check maximum age (null means no upper limit)
  if (ageMaxMonths !== null && childAgeMonths > ageMaxMonths) {
    return false;
  }

  return true;
}

/**
 * Filter activities by child's age
 * 
 * @param activities - List of activities
 * @param childAgeMonths - Child's age in months
 * @returns Filtered list of activities suitable for the child
 */
export function filterActivitiesByChildAge<T extends ActivityAgeRequirement>(
  activities: T[],
  childAgeMonths: number
): T[] {
  return activities.filter((activity) =>
    matchChildAge(childAgeMonths, activity)
  );
}

/**
 * Calculate child's age in months from birth date
 * 
 * @param birthDate - Child's birth date
 * @param referenceDate - Reference date (defaults to now)
 * @returns Age in months
 */
export function calculateAgeInMonths(
  birthDate: Date,
  referenceDate: Date = new Date()
): number {
  const years = referenceDate.getFullYear() - birthDate.getFullYear();
  const months = referenceDate.getMonth() - birthDate.getMonth();
  return years * 12 + months;
}
