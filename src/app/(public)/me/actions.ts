"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type ActionState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const addChildSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  birthDate: z.string().min(1, "Дата рождения обязательна"),
  interests: z.string().optional(),
});

export async function addChildAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Extract form data
  const payload = {
    name: String(formData.get("name") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    interests: String(formData.get("interests") ?? ""),
  };

  try {
    // Validate input
    const validated = addChildSchema.parse(payload);

    // Parse birthDate
    const birthDate = new Date(validated.birthDate);
    if (isNaN(birthDate.getTime())) {
      return {
        ok: false,
        message: "Некорректная дата рождения",
      };
    }

    // Create child
    await prisma.child.create({
      data: {
        name: validated.name,
        birthDate,
        interests: validated.interests || null,
        parentId: user.id,
      },
    });
  } catch (e) {
    // Handle Zod validation errors
    if (e instanceof z.ZodError) {
      return {
        ok: false,
        message: "Проверьте поля формы",
        fieldErrors: e.flatten().fieldErrors,
      };
    }

    // Generic error
    return {
      ok: false,
      message: "Не удалось добавить ребёнка. Попробуйте ещё раз.",
    };
  }

  // Success - revalidate and return success
  revalidatePath("/me");
  return { ok: true };
}
