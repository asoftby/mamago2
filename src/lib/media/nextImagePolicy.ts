export const NEXT_IMAGE_REMOTE_PATTERNS = [
  {
    protocol: "https" as const,
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https" as const,
    hostname: "**.unsplash.com",
  },
  {
    protocol: "https" as const,
    hostname: "family.by",
  },
  {
    protocol: "https" as const,
    hostname: "**.googleusercontent.com",
  },
];

function matchesHostname(pattern: string, hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (pattern.startsWith("**.")) {
    return normalized.endsWith(pattern.slice(2));
  }
  return normalized === pattern;
}

/** Whether a cover URL is accepted by the current Next/Image configuration. */
export function canOptimizeWithNextImage(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return NEXT_IMAGE_REMOTE_PATTERNS.some(
      (pattern) =>
        parsed.protocol === `${pattern.protocol}:` &&
        matchesHostname(pattern.hostname, parsed.hostname),
    );
  } catch {
    return false;
  }
}
