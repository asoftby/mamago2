import type {
  UserBirthdayParty,
  UserBirthdayPartyDetail,
} from "@/features/me/types/userBirthdayParty";

/**
 * Until persisted PartyOrder reads are implemented, return no parties.
 * The previous demo returned an invented booking to every signed-in user.
 */
export async function listUserBirthdayParties(
  userId: string,
): Promise<UserBirthdayParty[]> {
  void userId;
  return [];
}

export async function getUserBirthdayPartyDetail(
  userId: string,
  partyId: string,
): Promise<UserBirthdayPartyDetail | null> {
  void userId;
  void partyId;
  return null;
}
