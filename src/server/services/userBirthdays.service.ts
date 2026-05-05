import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";

export async function listUserBirthdayParties(userId: string): Promise<UserBirthdayParty[]> {
  void userId;
  console.log("[API] real data used", {
    service: "listUserBirthdayParties",
    empty: true,
  });
  return [];
}
