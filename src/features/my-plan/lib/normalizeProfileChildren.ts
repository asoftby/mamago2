import { childDisplayName } from "@/lib/child/birth";

export type MyPlanApiChild = {
  id: string;
  name: string | null;
  birthDate: string;
  systemInterests?: Array<{ interestSlug: string }>;
};

export function normalizeMyPlanProfileChildren(children: MyPlanApiChild[]) {
  let unnamedIndex = 0;
  return children.map((child) => {
    if (!child.name?.trim()) unnamedIndex += 1;
    return {
      id: child.id,
      name: childDisplayName(child.name, child.name?.trim() ? undefined : unnamedIndex),
      birthDate:
        typeof child.birthDate === "string"
          ? child.birthDate
          : new Date(child.birthDate as unknown as string).toISOString(),
      systemInterests: Array.isArray(child.systemInterests)
        ? child.systemInterests.map((item) => item.interestSlug)
        : [],
    };
  });
}
