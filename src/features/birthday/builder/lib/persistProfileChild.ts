type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BirthdayProfileChildUpdate = {
  id: string;
  name: string;
  birthDate: string;
  systemInterests: string[];
};

export async function persistBirthdayProfileChild(
  fetcher: Fetcher,
  child: BirthdayProfileChildUpdate,
): Promise<void> {
  const response = await fetcher(`/api/children/${child.id}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: child.name,
      birthDate: child.birthDate,
      birthPrecision: "DAY",
      systemInterests: child.systemInterests,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Не удалось сохранить");
  }
}
