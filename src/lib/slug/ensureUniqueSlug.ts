export async function ensureUniqueSlug(args: {
  base: string;
  isAvailable: (slug: string) => Promise<boolean>;
  maxAttempts?: number;
}): Promise<string> {
  const { base, isAvailable, maxAttempts = 200 } = args;
  let slug = base;
  let i = 2;
  while (!(await isAvailable(slug))) {
    slug = `${base}-${i}`;
    i++;
    if (i > maxAttempts) {
      throw new Error(`Could not generate unique slug for: ${base}`);
    }
  }
  return slug;
}

