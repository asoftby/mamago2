import { getBaseUrl } from "@/lib/routing/cityPaths";

export function articleCategoryHubPath(args: {
  categorySlug: string;
  citySlug?: string | null;
  page?: number;
}): string {
  const categorySlug = args.categorySlug.trim().toLowerCase();
  const citySlug = args.citySlug?.trim().toLowerCase();
  const basePath = citySlug
    ? `/${citySlug}/blog/category/${categorySlug}`
    : `/blog/category/${categorySlug}`;
  return args.page && args.page > 1 ? `${basePath}?page=${args.page}` : basePath;
}

export function articleCategoryHubUrl(args: {
  categorySlug: string;
  citySlug?: string | null;
  page?: number;
}): string {
  return `${getBaseUrl("BY")}${articleCategoryHubPath(args)}`;
}
