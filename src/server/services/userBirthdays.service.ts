import { MOCK_USER_BIRTHDAYS } from "@/features/me/data/mockUserBirthdays";
import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";
import { sortPartiesForProfile } from "@/features/me/lib/userBirthdayPartyUi";

/**
 * Список праздников пользователя для ЛК.
 * TODO: заменить на Prisma, когда появится сущность BirthdayParty / BirthdayRequest.
 */
export async function listUserBirthdayParties(userId: string): Promise<UserBirthdayParty[]> {
  const fromMock = MOCK_USER_BIRTHDAYS.filter(
    (p) => p.userId === userId || p.userId === "__every__",
  );
  return sortPartiesForProfile(fromMock);
}
